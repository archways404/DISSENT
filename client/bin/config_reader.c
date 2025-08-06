// gcc -o bin/config_reader bin/config_reader.c
// -I/opt/homebrew/opt/openssl/include -L/opt/homebrew/opt/openssl/lib -lcrypto
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SALT_LEN 16
#define IV_LEN 16
#define TAG_LEN 16
#define KEY_LEN 32

int main(int argc, char *argv[]) {
  if (argc < 2) {
    fprintf(stderr, "Usage: %s <cfg.enc>\n", argv[0]);
    return 1;
  }

  // Read passphrase from stdin
  char passphrase[256];
  if (!fgets(passphrase, sizeof(passphrase), stdin)) {
    fprintf(stderr, "No passphrase provided\n");
    return 2;
  }
  passphrase[strcspn(passphrase, "\n")] = 0; // strip newline

  FILE *fp = fopen(argv[1], "rb");
  if (!fp) {
    perror("fopen");
    return 3;
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
    fprintf(stderr, "Key derivation failed\n");
    free(ciphertext);
    return 4;
  }

  EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
  if (!ctx) {
    free(ciphertext);
    return 5;
  }

  if (!EVP_DecryptInit_ex(ctx, EVP_aes_256_gcm(), NULL, NULL, NULL) ||
      !EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, IV_LEN, NULL) ||
      !EVP_DecryptInit_ex(ctx, NULL, NULL, key, iv)) {
    EVP_CIPHER_CTX_free(ctx);
    free(ciphertext);
    return 6;
  }

  unsigned char *plaintext = malloc(cipherLen);
  int len, plaintextLen = 0;

  if (!EVP_DecryptUpdate(ctx, plaintext, &len, ciphertext, cipherLen)) {
    EVP_CIPHER_CTX_free(ctx);
    free(ciphertext);
    free(plaintext);
    return 7;
  }
  plaintextLen = len;

  EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, TAG_LEN, tag);

  if (EVP_DecryptFinal_ex(ctx, plaintext + len, &len) <= 0) {
    fprintf(stderr, "Decryption failed (wrong passphrase?)\n");
    EVP_CIPHER_CTX_free(ctx);
    free(ciphertext);
    free(plaintext);
    return 8;
  }
  plaintextLen += len;

  fwrite(plaintext, 1, plaintextLen, stdout);

  EVP_CIPHER_CTX_free(ctx);
  free(ciphertext);
  free(plaintext);
  return 0;
}