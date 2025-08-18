# DISSENT

> **D**ecentralized **I**nfrastructure for **S**ecure **S**peech and **E**ncryption **N**etwork against **T**otalitarianism

**DISSENT** is not just a project — it's a digital middle finger to authoritarian regimes, invasive surveillance states, and bureaucrats pushing totalitarian legislation like the EU's proposed ***Chat Control 2.0*** ([Wikipedia](https://en.wikipedia.org/wiki/Regulation_to_Prevent_and_Combat_Child_Sexual_Abuse)).

**[Chat Control 2.0](https://www.patrick-breyer.de/en/posts/chat-control/)** is not about safety.
It’s about control — an Orwellian power grab masquerading as child protection — one that seeks to scan, monitor, and intercept all private communication under the false pretense of “nothing to hide, nothing to fear.”  
That’s not security — that’s tyranny.

**DISSENT** exists to make mass surveillance **impossible** — denying governments the tools to **violate privacy**.

> **Privacy is not optional.**
> **It is a human right — not a permission slip granted by the state.**
> **No government has the moral authority to decide who deserves privacy.**

---

### On CSAM and Misused Justifications
**DISSENT absolutely condemns child sexual abuse material (CSAM).**

Its existence is abhorrent and tragic, and fighting it is a moral necessity.

But authoritarian mass surveillance is **NOT** the solution.

- If governments cannot keep CSAM off the open internet, why should we believe they can magically eliminate it by scanning our **private devices and messages**?
- Mass device surveillance will not stop determined criminals — it will, however, destroy privacy for everyone.
- Every backdoor created “for safety” becomes a front door for **hackers**, **hostile governments**, and **corrupt officials**.

---

### What makes DISSENT unique?

- **No central kill switch**
  > Fully decentralized and federated. There’s no single company, server, or jurisdiction to pressure. Take one node down, the rest keep running.
- **Client-side encryption only**
  > Messages are encrypted before they leave your device, with keys that never touch a server unless you choose to share them (still encrypted end-to-end before transit). Even network operators can’t read them.
- **Metadata resistance**
  > Routes messages through Tor relays, obfuscates size and timing, and removes user identifiers. No accounts, no phone numbers — just conversations with no link to “who.”
- **Message compartmentalization**
  > Each message is independently encrypted. Cracking one reveals nothing about any others.
- **Persistence under attack**
  > If a server is seized, other servers retain the message. If none do, it will be resent until delivered.
- **Open-source & auditable**
  > Anyone can verify the code. No secret backdoors, and no way to silently add one without the world noticing.
- **Purpose-built to preserve fundamental rights against mass surveillance legislation like Chat Control 2.0.**
  > Unlike **[Signal](https://signal.org/)** or **[Telegram](https://telegram.org/)**, DISSENT’s architecture leaves nothing for mass-scanning legislation to grab onto. The protocol itself denies surveillance by design.
---

### "Nothing to hide, nothing to fear" is the mantra of fools.

If you’re fine being watched, recorded, scanned, and profiled — that’s your choice. But **no one** gets to make that choice for everyone else.

Surveillance is not safety.  
Silence is not peace.  
Compliance is not freedom.

---

## Principles

- Privacy is a human right.  
- Security must not depend on trust.  
- No central authority should control communication.  
- Openness and peer review beat secrecy.  
- Usability matters — privacy for everyone, not just experts.

---

### Roadmap

> **v0.0.1 → v0.1.0 — Proof of Concept** (Current)
- Built in **JavaScript** to validate architecture and feature set.
- Minimal protection against config file tampering, memory inspection, or forensic tools — focus is **function over fortress**.
- Implements basic client–server infrastructure with end-to-end encryption and decentralized federation.

> **v0.1.1 → v0.2.0 — Hardened Rebuild**
- Core components re-written in **C** or **Rust** to resist local file tampering, DMA attacks, memory scraping, and forensic analysis.
- Reduced attack surface by removing non-essential dependencies and abstractions.
- Designed with the goal of resisting even state-level surveillance, subject to open review and community audit.

> **v0.2.x+ — Growth & Optimization**
- Performance tuning and protocol optimizations.
- Advanced stealth features:
  - Traffic obfuscation and censorship resistance.
  - Onion routing, domain fronting, and protocol camouflage.
- New features to empower **secure**, **private**, and **unstoppable communication**.
- Continuous security audits and hardening to stay ahead of adversaries.

---

## Contribute

DISSENT is an open-source project built to defend privacy and free speech.  
We welcome developers, researchers, activists, and anyone who believes in a free internet to join us.

### Ways to Contribute
- **Code** — Build the protocol, clients, and server implementations.  
- **Security** — Audit code, report vulnerabilities, propose mitigations.  
- **Research** — Explore censorship resistance, metadata protection, anonymity.  
- **Docs & UX** — Write guides, improve onboarding, make privacy usable.  
- **Community** — Translate, advocate, and help grow a healthy ecosystem.

### How to Get Started
1. **Star & fork** the repository.  
2. Browse **Issues** for open tasks and **good first issues**.  
3. Open a **draft PR** early to discuss approach and align on design.  
4. Chat with maintainers in community channels (TBA).  
5. Follow the **Style Guide** and **Security Guidelines** below.

### Contribution Guidelines
- Keep code clean, modular, and well-documented.  
- Favor small, reviewable PRs over mega-changes.  
- Tests accompany features; fuzz or property tests where applicable.  
- Security > features. If a tradeoff is required, open an issue and discuss.  
- No backdoors, no compromises. Ever.

---

## Security

If you discover a security issue, **please do not open a public issue**.  
Email the security team at: **security@dissent.example** (PGP key TBA).  
We’ll acknowledge receipt within 72 hours and work with you on coordinated disclosure.

---

## Code of Conduct

Be respectful. Assume good faith. No harassment or discrimination of any kind.  
We follow a modified Contributor Covenant. Report issues to **conduct@dissent.example**.

---

## Acknowledgments

DISSENT stands on the shoulders of giants: work from the communities around **Tor**, **Signal**, **Matrix**, **Noise Protocol**, **libsodium**, and digital rights groups like **EDRi**, **EFF**, and **FSFE**.

---

## License

`GPL-3.0-or-later` (proposed).  
Why: strong copyleft to prevent closed forks inserting surveillance or telemetry.  
(If your org needs permissive licensing for specific components, open a discussion.)

---

## Disclaimer

Cryptography is subtle and easy to get wrong. Early versions are **experimental** and **not yet suitable for high-risk use**. Use at your own discretion until independent audits are complete.

---

“DISSENT is an open call. If you’re a developer, researcher, or privacy advocate — join us. Review the code, contribute, and help make censorship-resistant communication a reality.”

**Stay free. Stay private.**  
**-DISSENT.**
