---

# 🛡️ AI Security CI (Phase 1 MVP)
Automated **AI prompt security testing** that runs in your CI pipeline.  
Think: *Unit tests / SAST — but for AI prompts & agents.*

## 🚀 What it does
- Runs simulated prompt attacks (jailbreak, leak attempts, harmful instructions)
- Tests your **system prompt**, **RAG pipeline**, or **AI endpoint**
- Reports vulnerabilities in Markdown + JSON
- Optionally fails CI on high-severity issues (`fail_on_high`)
- Supports GitHub Actions, local CLI, and DEMO_MODE (zero cost)

---

## 📦 Install (GitHub Actions)

Create `.github/workflows/ai-security.yml`:

```yaml
name: AI Security Check
on: [pull_request]

jobs:
  ai_security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run AI Security
        uses: your-user/ai-security-ci@v1
        with:
          config_path: "ai-sec-config.yaml"
          fail_on_high: "true"
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
