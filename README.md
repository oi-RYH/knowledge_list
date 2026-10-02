# knowledge_list

AI가 만든 결과물에 **무엇을 사용했고, 왜 사용했으며, 어떤 과정을 거쳤는지** 사용자가 직접 설명할 수 있도록 돕는 개인 지식 기록 저장소입니다. 프로젝트가 동작하는 것만으로 끝내지 않고, AI가 대신 수행한 과정과 판단을 드러냅니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | AI의 지식 확인·설명·기록 규칙 |
| `TECH_KNOWLEDGE.md` | 기술과 개념 자체의 이해 수준 |
| `WORKFLOW_KNOWLEDGE.md` | 실제 작업 과정의 이해 수준 |
| `AI_WORK_LOG_TEMPLATE.md` | 중요한 프로젝트의 실제 AI 작업 기록 양식 |
| `README.md` | 설치와 동기화 방법 |

## 상태

| 상태 | 의미 |
|---|---|
| ✅ Known / 이해함 | 핵심 개념·이유·역할을 다른 사람에게 설명할 수 있음 |
| 🟡 Familiar / 익숙함 | 접하거나 사용해 봤지만 설명에는 복습이 필요함 |
| ⬜ Not Learned / 미학습 | 사용자가 아직 모른다고 명시적으로 확인함 |
| ❓ Unreviewed / 미확인 | 새로 등장했지만 이해 수준을 아직 확인하지 않음 |

목록에 없는 항목은 아직 추적하지 않은 새 항목일 뿐, 사용자가 모른다는 뜻이 아닙니다.

## 설치: macOS

원하는 폴더에서 저장소를 복제한 뒤, 전역 Codex 폴더의 세 파일을 저장소 파일에 연결합니다. 기존 전역 파일이 있으면 내용을 먼저 확인하고 백업하세요. 아래 명령의 `$HOME/knowledge_list`는 실제 복제 위치에 맞게 바꾸세요.

```sh
git clone git@github.com:oi-RYH/knowledge_list.git "$HOME/knowledge_list"
mkdir -p "$HOME/.codex"
ln -s "$HOME/knowledge_list/AGENTS.md" "$HOME/.codex/AGENTS.md"
ln -s "$HOME/knowledge_list/TECH_KNOWLEDGE.md" "$HOME/.codex/TECH_KNOWLEDGE.md"
ln -s "$HOME/knowledge_list/WORKFLOW_KNOWLEDGE.md" "$HOME/.codex/WORKFLOW_KNOWLEDGE.md"
```

기존 이름의 파일이 있으면 `ln -s`가 실패합니다. 내용을 저장소 쪽에 반영한 후 기존 파일을 안전한 위치로 옮기고 다시 실행하세요.

## 설치: Windows PowerShell

Git과 GitHub 인증을 준비한 뒤 PowerShell에서 실행합니다. 기존 전역 파일이 있으면 내용을 확인하고 백업하세요. 심볼릭 링크 생성에는 Windows 개발자 모드 또는 관리자 권한이 필요할 수 있습니다.

```powershell
git clone git@github.com:oi-RYH/knowledge_list.git "$HOME\knowledge_list"
New-Item -ItemType Directory -Force "$HOME\.codex"
New-Item -ItemType SymbolicLink -Path "$HOME\.codex\AGENTS.md" -Target "$HOME\knowledge_list\AGENTS.md"
New-Item -ItemType SymbolicLink -Path "$HOME\.codex\TECH_KNOWLEDGE.md" -Target "$HOME\knowledge_list\TECH_KNOWLEDGE.md"
New-Item -ItemType SymbolicLink -Path "$HOME\.codex\WORKFLOW_KNOWLEDGE.md" -Target "$HOME\knowledge_list\WORKFLOW_KNOWLEDGE.md"
```

기존 파일이 있으면 링크 생성이 실패합니다. 내용을 저장소 쪽에 반영한 후 기존 파일을 옮기고 다시 실행하세요. SSH 인증을 쓰지 않는 경우 복제 주소를 `https://github.com/oi-RYH/knowledge_list.git`로 바꾸고 GitHub 인증을 완료하세요.

## 여러 기기에서 동기화

각 기기에서 한 번씩 복제하고 위의 링크를 만듭니다. 작업을 시작하기 전에 복제 폴더에서 최신 내용을 가져오고, 변경 후 커밋·푸시합니다. 다른 기기에서도 다음 작업 전 다시 가져옵니다.

```sh
cd ~/knowledge_list
git pull --ff-only origin main
git add AGENTS.md TECH_KNOWLEDGE.md WORKFLOW_KNOWLEDGE.md AI_WORK_LOG_TEMPLATE.md README.md
git commit -m "Update knowledge records"
git push origin main
```

Windows에서도 PowerShell에서 같은 Git 명령을 사용할 수 있습니다. 변경한 파일이 없으면 커밋 단계는 건너뜁니다. 두 기기에서 동시에 같은 파일을 바꿨다면 충돌을 확인하고 합친 뒤 푸시합니다.

## 운영 원칙

- 체크리스트 두 개는 프로젝트별로 나누지 않는 **전역 통합 기록**입니다.
- 실제 작업에서 등장해 산출물을 설명하거나 재현하는 데 의미 있는 항목만 추가합니다. 새 항목은 ❓로 등록하고 사용자에게 이해 여부를 확인합니다.
- 상태는 사용자가 이해 수준을 명시적으로 확인하거나 변경을 요청할 때만 바꿉니다. AI가 사용하거나 설명했다는 사실만으로 ✅로 올리지 않습니다.
- 모든 항목에 `등록일`과 `최종 확인일`을 둡니다. 등록일은 최초 추가일로 유지합니다. 최종 확인일은 사용자 확인 또는 상태 변경 시에만 `YYYY-MM-DD`로 기록하며, 아직 확인하지 않은 ❓는 `—`로 둡니다.
- 중요한 프로젝트에는 `AI_WORK_LOG_TEMPLATE.md`를 바탕으로 프로젝트 내부에 `AI_WORK_LOG.md`를 두고 AI가 실제 수행한 명령, 파일 변경, 판단을 기록합니다.
