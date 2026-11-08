# Prompt-lar

| Kim | Fayl |
|---|---|
| Lead (Shared, Backend, Web, Integration) | [`lead.md`](lead.md) |
| Mobil komanda yoldaşı (Mobile) | [`mobile.md`](mobile.md) |

## Claude Code əmrləri (repo ilə gəlir — `.claude/commands/`)
| Əmr | İstifadə |
|---|---|
| `/next-step <track>` | `shared` · `backend` · `web` · `mobile` · `integration` |
| `/step <ID>` | məs. `/step B-07` |
| `/finish-step <ID>` | DoD + progress + PR |
| `/status` | bütün track-lər |
| `/sync` | `main`-dən yenilənmə |
| `/contract-change <təsvir>` | API müqaviləsi dəyişikliyi |

## Subagent-lər (`.claude/agents/`)
- `code-reviewer` — diff-i layihə qaydalarına görə yoxlayır
- `contract-guardian` — müqavilə ↔ client ↔ mock ↔ backend uyğunluğu

## Skills
Prompt-larda adı çəkilən skill-lər (`superpowers:*`, `frontend-design`, `security-and-hardening` və s.) sizdə quraşdırılmayıbsa, Claude onları atlayır və eyni işi adi qaydada görür — protokol yenə də `.claude/commands/step.md`-dədir.
