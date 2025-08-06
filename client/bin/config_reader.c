// gcc -o ./bin/config_reader ./bin/config_reader.c \
//   -I$(brew --prefix openssl)/include \
//   -L$(brew --prefix openssl)/lib \
//   -lcrypto

#define _GNU_SOURCE
#include <errno.h>
#include <openssl/bio.h>
#include <openssl/buffer.h>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#define SALT_LEN 16
#define IV_LEN 16
#define TAG_LEN 16
#define KEY_LEN 32
#define SOCK_PATH "/tmp/protectu84.sock"

static unsigned char session_key[KEY_LEN];

void secure_zero(void *v, size_t n) {
  volatile unsigned char *p = v;
  while (n--)
    *p++ = 0;
}

void cleanup_socket() { unlink(SOCK_PATH); }

void handle_exit(int sig) {
  secure_zero(session_key, KEY_LEN);
  cleanup_socket();
  exit(0);
}

// Base64 encode helper
char *base64_encode(const unsigned char *input, int length) {
  BIO *bmem, *b64;
  BUF_MEM *bptr;
  b64 = BIO_new(BIO_f_base64());
  BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL); // no newlines
  bmem = BIO_new(BIO_s_mem());
  b64 = BIO_push(b64, bmem);
  BIO_write(b64, input, length);
  BIO_flush(b64);
  BIO_get_mem_ptr(b64, &bptr);

  char *buff = malloc(bptr->length + 1);
  memcpy(buff, bptr->data, bptr->length);
  buff[bptr->length] = 0;

  BIO_free_all(b64);
  return buff;
}

// Base64 decode helper
unsigned char *base64_decode(const char *input, int length, int *out_len) {
  BIO *b64, *bmem;
  unsigned char *buffer = malloc(length);
  b64 = BIO_new(BIO_f_base64());
  BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
  bmem = BIO_new_mem_buf((void *)input, length);
  bmem = BIO_push(b64, bmem);
  *out_len = BIO_read(bmem, buffer, length);
  BIO_free_all(bmem);
  return buffer;
}

int decrypt_config(const char *cfgpath, const char *passphrase,
                   unsigned char *identifier_out) {
  FILE *fp = fopen(cfgpath, "rb");
  if (!fp) {
    perror("fopen");
    return 0;
  }

  unsigned char salt[SALT_LEN], iv[IV_LEN], tag[TAG_LEN];
  fread(salt, 1, SALT_LEN, fp);
  fread(iv, 1, IV_LEN, fp);
  fread(tag, 1, TAG_LEN, fp);

  fseek(fp, 0, SEEK_END);
  long fileSize = ftell(fp);
  fseek(fp, SALT_LEN + IV_LEN + TAG_LEN, SEEK_SET);

  long cipherLen = fileSize - (SALT_LEN + IV_LEN + TAG_LEN);
  unsigned char *ciphertext = malloc(cipherLen);
  fread(ciphertext, 1, cipherLen, fp);
  fclose(fp);

  unsigned char key[KEY_LEN];
  if (!PKCS5_PBKDF2_HMAC(passphrase, strlen(passphrase), salt, SALT_LEN, 100000,
                         EVP_sha256(), KEY_LEN, key)) {
    free(ciphertext);
    return 0;
  }

  EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
  if (!ctx) {
    free(ciphertext);
    return 0;
  }

  int outlen;
  if (!EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) ||
      !EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, IV_LEN, NULL) ||
      !EVP_DecryptInit_ex(ctx, NULL, NULL, key, iv) ||
      !EVP_DecryptUpdate(ctx, identifier_out, &outlen, ciphertext, cipherLen) ||
      !EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, TAG_LEN, tag) ||
      EVP_DecryptFinal_ex(ctx, identifier_out + outlen, &outlen) <= 0) {
    EVP_CIPHER_CTX_free(ctx);
    free(ciphertext);
    return 0;
  }

  EVP_CIPHER_CTX_free(ctx);
  free(ciphertext);
  return 1;
}

int encrypt_with_session(const unsigned char *plaintext, int plaintext_len,
                         unsigned char **out_buf, int *out_len) {
  unsigned char iv[IV_LEN];
  RAND_bytes(iv, IV_LEN);

  EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
  if (!ctx)
    return 0;

  if (!EVP_EncryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, session_key, iv)) {
    EVP_CIPHER_CTX_free(ctx);
    return 0;
  }

  unsigned char *ciphertext = malloc(plaintext_len + TAG_LEN + IV_LEN);
  int len, total_len = 0;

  if (!EVP_EncryptUpdate(ctx, ciphertext, &len, plaintext, plaintext_len)) {
    EVP_CIPHER_CTX_free(ctx);
    free(ciphertext);
    return 0;
  }
  total_len = len;

  if (!EVP_EncryptFinal_ex(ctx, ciphertext + total_len, &len)) {
    EVP_CIPHER_CTX_free(ctx);
    free(ciphertext);
    return 0;
  }
  total_len += len;

  unsigned char tag[TAG_LEN];
  EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, TAG_LEN, tag);

  *out_len = IV_LEN + TAG_LEN + total_len;
  *out_buf = malloc(*out_len);
  memcpy(*out_buf, iv, IV_LEN);
  memcpy(*out_buf + IV_LEN, tag, TAG_LEN);
  memcpy(*out_buf + IV_LEN + TAG_LEN, ciphertext, total_len);

  EVP_CIPHER_CTX_free(ctx);
  free(ciphertext);
  return 1;
}

int decrypt_with_session(const unsigned char *in_buf, int in_len,
                         unsigned char **plaintext, int *plaintext_len) {
  if (in_len < IV_LEN + TAG_LEN)
    return 0;

  const unsigned char *iv = in_buf;
  const unsigned char *tag = in_buf + IV_LEN;
  const unsigned char *ciphertext = in_buf + IV_LEN + TAG_LEN;
  int cipher_len = in_len - IV_LEN - TAG_LEN;

  EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
  if (!ctx)
    return 0;

  int len, final_len;
  *plaintext = malloc(cipher_len + 1); // +1 for null terminator
  if (!EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, session_key, iv) ||
      !EVP_DecryptUpdate(ctx, *plaintext, &len, ciphertext, cipher_len) ||
      !EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, TAG_LEN, (void *)tag) ||
      EVP_DecryptFinal_ex(ctx, *plaintext + len, &final_len) <= 0) {
    EVP_CIPHER_CTX_free(ctx);
    free(*plaintext);
    return 0;
  }
  *plaintext_len = len + final_len;
  (*plaintext)[*plaintext_len] = '\0'; // safe null-termination

  EVP_CIPHER_CTX_free(ctx);
  return 1;
}

void server_loop() {
  int server_fd, client_fd;
  struct sockaddr_un addr;
  char buf[4096];

  unlink(SOCK_PATH);
  server_fd = socket(AF_UNIX, SOCK_STREAM, 0);
  memset(&addr, 0, sizeof(addr));
  addr.sun_family = AF_UNIX;
  strncpy(addr.sun_path, SOCK_PATH, sizeof(addr.sun_path) - 1);

  bind(server_fd, (struct sockaddr *)&addr, sizeof(addr));
  listen(server_fd, 5);

  printf("READY\n");
  fflush(stdout);

  while (1) {
    client_fd = accept(server_fd, NULL, NULL);
    if (client_fd < 0)
      continue;
    int r = read(client_fd, buf, sizeof(buf) - 1);
    if (r > 0) {
      buf[r] = 0;
      if (strncmp(buf, "ENCRYPT ", 8) == 0) {
        unsigned char *out;
        int outlen;
        encrypt_with_session((unsigned char *)buf + 8, strlen(buf + 8), &out,
                             &outlen);
        char *b64 = base64_encode(out, outlen);
        write(client_fd, b64, strlen(b64));
        free(out);
        free(b64);
      } else if (strncmp(buf, "DECRYPT ", 8) == 0) {
        int bin_len;
        unsigned char *bin = base64_decode(buf + 8, strlen(buf + 8), &bin_len);
        unsigned char *plain;
        int plain_len;
        if (decrypt_with_session(bin, bin_len, &plain, &plain_len)) {
          write(client_fd, plain, plain_len); // send exactly plain_len bytes
          free(plain);
        } else {
          write(client_fd, "ERR", 3);
        }
        free(bin);
      } else if (strncmp(buf, "EXIT", 4) == 0) {
        close(client_fd);
        break;
      }
    }
    close(client_fd);
  }

  cleanup_socket();
}

int main(int argc, char *argv[]) {
  signal(SIGTERM, handle_exit);
  signal(SIGINT, handle_exit);

  if (argc >= 3 && strcmp(argv[1], "--server") == 0) {
    char pass[256];
    if (!fgets(pass, sizeof(pass), stdin)) {
      fprintf(stderr, "No passphrase\n");
      return 1;
    }
    pass[strcspn(pass, "\n")] = 0;

    unsigned char identifier[KEY_LEN];
    if (!decrypt_config(argv[2], pass, identifier)) {
      fprintf(stderr, "Unlock failed\n");
      return 1;
    }
    secure_zero(pass, sizeof(pass));

    memcpy(session_key, identifier, KEY_LEN);
    server_loop();
    return 0;
  }

  if (argc != 2) {
    fprintf(stderr, "Usage: %s <cfg.enc> OR %s --server <cfg.enc>\n", argv[0],
            argv[0]);
    return 1;
  }

  char pass[256];
  if (!fgets(pass, sizeof(pass), stdin)) {
    fprintf(stderr, "No passphrase\n");
    return 1;
  }
  pass[strcspn(pass, "\n")] = 0;

  unsigned char identifier[KEY_LEN];
  if (!decrypt_config(argv[1], pass, identifier)) {
    fprintf(stderr, "Decryption failed\n");
    return 1;
  }
  secure_zero(pass, sizeof(pass));

  for (int i = 0; i < KEY_LEN; i++) {
    printf("%02x", identifier[i]);
  }
  printf("\n");
  return 0;
}