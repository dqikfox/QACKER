# QACKER

**QACKER** is a security research, vulnerability-assessment, and penetration-testing dashboard built to consolidate defensive tooling into a single operational interface.

Its broader mission is to support lawful security research and authorized investigations involving communication systems, exposed infrastructure, and other technical environments that may be abused by malicious actors — including online predators seeking poorly monitored or weakly secured channels.

> **Project status:** QACKER is approaching completion. Core dashboard functionality and major tool integrations are already in place, while the remaining work is focused on refinement, validation, reporting workflows, evidence handling, and hardening.

---

## 🛡️ Project Purpose: Security Research & Vulnerability Assessment

QACKER is being engineered to evaluate weaknesses across conventional network infrastructure as well as direct-to-device and simplex-style communication architectures.

Modern platforms often include centralized authentication, logging, abuse reporting, moderation, and extensive telemetry. Smaller, legacy, direct-band, peer-to-peer, or otherwise isolated systems may provide far less visibility. That can make them attractive to people who believe those environments offer anonymity or reduced oversight.

QACKER exists to help authorized researchers and investigators identify those blind spots, document weaknesses, correlate technical metadata, and produce structured findings that can be handed to the appropriate security teams or authorities.

---

## 🎯 Counter-Predator Mission

A central long-term objective of QACKER is to assist legitimate investigators in the **identification, location, and apprehension of individuals engaged in online predatory activity**.

QACKER is not intended to determine guilt or replace a law-enforcement investigation. Its role is at the technical evidence and attribution layer: helping transform otherwise disconnected technical observations into defensible investigative leads.

Where there is proper authorization and a lawful basis for investigation, relevant indicators may include:

- timestamps and activity timelines;
- IP addresses and network ranges;
- protocol and session metadata;
- device or endpoint identifiers;
- authentication events;
- service banners and software versions;
- DNS, domain, routing, and hosting information;
- radio, channel, or transmission identifiers;
- recurring infrastructure relationships;
- cryptographic hashes;
- file, image, document, or media metadata where lawfully obtained;
- account or platform identifiers supplied through authorized channels.

A single metadata point rarely proves identity. The objective is correlation.

**Observed endpoint → metadata → infrastructure correlation → timeline → investigative lead**

For example, recurring technical identifiers may establish that several incidents involve the same infrastructure. That finding may allow authorized investigators to determine which ISP, hosting provider, platform, telecommunications provider, or service operator could hold additional records. Through the appropriate legal process, those records may contribute to identifying or physically locating a suspect.

QACKER is intended to support that process — not bypass it.

---

## 🧭 Years of Research and Iteration

QACKER is not the result of a single experiment or one short development cycle.

Over the course of several years, we have explored and tested multiple approaches to identifying useful technical indicators, correlating infrastructure, improving defensive reconnaissance, and determining how security tooling could better support investigations involving concealed or poorly monitored communication channels.

Those earlier approaches produced **mixed and often limited results**. Some methods generated useful observations, some proved unreliable outside controlled conditions, and others did not provide sufficient confidence or repeatability to become part of a serious investigative workflow.

To date, those earlier methods have **not produced a successful real-world apprehension attributable to QACKER**, and the project does not claim otherwise.

That history is important because QACKER has been shaped by those limitations. The present design emphasizes:

- repeatable technical collection rather than speculation;
- metadata correlation rather than single-point attribution;
- structured telemetry rather than undocumented observations;
- validation of findings before escalation;
- evidence integrity and provenance;
- clear separation between technical indicators and conclusions about identity;
- lawful handoff to investigators rather than vigilante action.

The current QACKER architecture represents the convergence of that multi-year experimentation. The project is now **nearing functional completion**, with the principal architecture and major integrations established. Remaining work is concentrated on strengthening reliability, reporting, evidence-preservation workflows, correlation logic, test coverage, and operational safeguards.

In other words, QACKER is no longer merely an experimental concept. It is moving into the final stage of becoming a coherent, testable security-research platform.

---

## 🔎 Threat Hunting and Technical Attribution

QACKER may assist authorized investigations that begin with technical leads such as:

- a suspicious endpoint;
- an exposed service;
- repeated identifiers;
- unusual or anomalous traffic;
- an insecure communications protocol;
- infrastructure supplied by an investigator;
- a device recovered during an investigation;
- a documented abuse report;
- suspicious transmission behavior;
- metadata supplied through lawful investigative channels.

The goal is to answer technically useful questions:

- What infrastructure was involved?
- When was the activity observed?
- Which identifiers appeared repeatedly?
- Were the same endpoints involved in multiple incidents?
- Was authentication weak, absent, spoofable, or misconfigured?
- What services and software versions were exposed?
- Which providers may hold additional records?
- Can another investigator independently reproduce the finding?

QACKER treats technical attribution as a chain of evidence, not an accusation.

IP addresses can be shared. Devices can be stolen. Credentials can be compromised. Identifiers can be spoofed. VPNs, proxies, relays, carrier-grade NAT, and compromised hosts can obscure origin. For that reason, QACKER is designed to generate investigative leads that can be verified through legitimate investigative processes.

---

## 🧩 Metadata Correlation

One of QACKER's core investigative goals is to organize and correlate technical metadata across multiple observations.

Useful correlation dimensions may include:

### Network
- IP addresses
- ports
- protocols
- routing data
- domains
- autonomous-system information
- exposed network services

### Device / Endpoint
- protocol identifiers
- device identifiers
- firmware characteristics
- service fingerprints
- recurring configuration traits

### Temporal
- timestamps
- session durations
- recurrence patterns
- event sequences
- transmission windows

### Infrastructure
- hosting providers
- relays
- gateways
- recurring servers
- shared services
- common configurations

### Evidence
- cryptographic hashes
- collection timestamps
- source references
- analyst annotations
- provenance records

The objective is to build a technically defensible relationship graph that investigators can examine and independently validate.

---

## 🧰 CyberStrike Dashboard

QACKER currently provides a web dashboard for driving a security-testing arsenal from a single UI:

- **nmap**
- **nikto**
- **sqlmap**
- **nuclei**
- **ffuf**
- **httpx**
- **subfinder**
- **katana**
- **dalfox**
- **waybackurls**
- **Metasploit Framework** (`msfconsole` + `msfvenom`)
- **SecLists**

Each tool has a form built around commonly used flags and options. The server builds a fixed argument array and launches the corresponding binary directly rather than concatenating user input into a shell command.

The underlying tools must already be installed and available on `PATH` in the environment running the dashboard.

---

## 🧰 Metasploit and Authorized Vulnerability Validation

QACKER integrates with **Metasploit Framework** as an authorized vulnerability-validation component.

Metasploit can be useful when a security team needs to determine whether an identified vulnerability is genuinely reachable and exploitable under controlled conditions rather than merely theoretical.

Appropriate uses include:

- validating known vulnerabilities against owned or authorized systems;
- reproducing vulnerabilities in controlled laboratory environments;
- evaluating defensive controls;
- confirming remediation effectiveness;
- documenting exploitability for security reports;
- testing deliberately vulnerable systems;
- conducting penetration tests under explicit authorization.

A typical defensive workflow is:

**Discovery → Enumeration → Vulnerability Identification → Controlled Validation → Evidence Capture → Remediation / Investigative Reporting**

Metasploit integration does **not** authorize compromising third-party systems, suspects' devices, accounts, or infrastructure.

---

## 📡 Simplex and Direct-Communication Research

QACKER has a particular research interest in simplex and direct-device communications because these environments may lack security controls common to centralized platforms.

Potential weaknesses can include:

- spoofable node identities;
- weak or absent authentication;
- predictable identifiers;
- insecure protocol implementations;
- exposed management interfaces;
- undocumented endpoints;
- insufficient logging;
- insecure device configurations;
- protocol-level trust assumptions.

Where testing is lawful and authorized, documenting these weaknesses can help operators prevent obscure communication environments from becoming attractive places for abuse.

---

## 📁 Evidentiary Documentation

Another project objective is to make security findings usable beyond the initial technical assessment.

Where appropriate, QACKER aims to support structured evidence handling through:

- precise timestamps;
- UTC normalization;
- event sequencing;
- cryptographic hashing;
- source identification;
- collection-method documentation;
- immutable or append-only logging strategies;
- analyst annotations;
- evidence identifiers;
- exportable incident reports;
- preservation of original data;
- separation of raw evidence from derived analysis.

The preferred evidence model is:

**Original Evidence → Integrity Verification → Technical Analysis → Investigative Interpretation → Authorized Handover**

QACKER must never be used to fabricate, plant, alter, exaggerate, or selectively manipulate evidence.

---

## 🤝 Supporting Law-Enforcement Investigations

The desired outcome of QACKER's counter-predator mission is to provide legitimate investigators with stronger technical leads.

Conceptually, a finding may progress through a chain such as:

**Endpoint → Infrastructure → Provider → Lawful Records Request → Additional Attribution → Identification / Location → Investigation / Apprehension**

QACKER's role is primarily in the first stages: discovering, documenting, validating, correlating, and preserving the technical evidence needed to justify further investigation.

The project does not replace warrants, subpoenas, court orders, provider cooperation, police investigation, forensic examination, or judicial process.

---

## 🧭 Investigative Philosophy

QACKER follows a defense-first model:

**Discover → Enumerate → Correlate → Validate → Document → Preserve → Report**

### Discover
Identify suspicious infrastructure, exposed endpoints, abnormal transmissions, insecure protocols, or relevant technical indicators.

### Enumerate
Determine what systems, services, protocols, identifiers, and controls are present.

### Correlate
Compare metadata across observations to identify meaningful technical relationships.

### Validate
Where explicitly authorized, verify suspected vulnerabilities using controlled security-testing methodologies and tools such as Metasploit.

### Document
Record what was observed, how it was observed, and which tools were used.

### Preserve
Protect original evidence using appropriate hashing, timestamps, provenance tracking, and evidence-management practices.

### Report
Provide findings to system owners, security teams, platforms, child-protection organizations, or law-enforcement authorities as appropriate.

---

## ⚠️ No Vigilantism, Entrapment, or Unauthorized Surveillance

QACKER's mission to assist investigators does not grant private individuals investigative powers they do not otherwise possess.

QACKER must not be used to:

- unlawfully intercept private communications;
- compromise suspects' accounts, devices, or infrastructure;
- deploy malware;
- conduct unauthorized exploitation;
- obtain private subscriber records without lawful authority;
- track a person's physical location through unauthorized access;
- impersonate minors in unauthorized operations;
- entrap individuals;
- dox suspected individuals;
- publicly accuse individuals solely from technical indicators;
- threaten or harass suspects;
- plant or manipulate evidence;
- bypass lawful investigative procedures.

When serious criminal activity is encountered, the preferred course is:

**Preserve → Document → Escalate**

rather than independent pursuit or confrontation.

---

## ⚙️ Setup

```bash
npm install
npm start
```

The dashboard is served at `http://localhost:3000` by default. Override this with the `PORT` environment variable.

---

## 📚 SecLists Wordlist Browser

The dashboard can browse a local [SecLists](https://github.com/danielmiessler/SecLists) checkout so wordlist paths can be supplied to tools such as `ffuf`.

Point the dashboard at a checkout using the `SECLISTS_PATH` environment variable, or clone SecLists into `./SecLists` at the project root. That directory is ignored by Git.

---

## 🧪 Tests

```bash
npm test
```

---

## 🔐 Security Notes

- Tool invocations use `child_process.spawnSync` with `shell: false` and a fixed argument array. User-supplied values are not concatenated into shell command strings.
- The SecLists browser resolves and validates paths to remain inside the configured root directory, reducing path-traversal risk.
- QACKER executes real security tooling. Only run it against systems you own or are explicitly authorized to test.

---

## ⚖️ Disclaimer & Ethical Use Policy

QACKER is built strictly for defensive security research, authorized penetration testing, legitimate incident response, controlled laboratory research, and lawful investigative cooperation.

Possession of QACKER, Metasploit, or any other security framework does not grant authorization to access, intercept, exploit, monitor, locate, or compromise third-party systems or individuals.

Users are responsible for complying with all applicable laws, regulations, licenses, contractual obligations, privacy requirements, telecommunications rules, radio-spectrum rules, and investigative authorities in their jurisdiction.

**Authorization is a prerequisite, not an optional safeguard.**

---

## 🛡️ Long-Term Objective

> **Identify vulnerable communication environments, correlate lawful technical metadata, expose relevant infrastructure relationships, preserve defensible evidence, and assist legitimate investigators in identifying, locating, and apprehending individuals engaged in online predatory activity.**

QACKER should ultimately be judged not by how aggressively systems can be attacked, but by how effectively vulnerabilities can be identified, victims can be protected, evidence can be preserved, investigative leads can be strengthened, and appropriate authorities can be supported.
