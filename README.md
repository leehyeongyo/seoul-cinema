# 서울 개봉 캘린더

서울 극장(CGV·롯데시네마·메가박스·독립예술영화관)에 걸리는 영화를 매일 새벽 자동으로 모아서, 개봉일·재개봉일 기준 달력 사이트로 보여줘요. 날짜를 누르면 그날 개봉하는 영화가, 영화를 누르면 상영하는 극장 목록이 나와요.

서버나 비용 없이 GitHub만으로 돌아가요. GitHub Actions가 매일 새벽 5시쯤 데이터를 모아 `docs/data/films.json`에 저장하고, GitHub Pages가 `docs/` 폴더를 사이트로 보여줘요.


## 처음 설정 (한 번만, 20~30분)

### 1. KOBIS 키 발급

영화진흥위원회 KOBIS 오픈API 사이트(https://www.kobis.or.kr/kobisopenapi)에서 회원가입 후 키를 발급받아요. 심사 없이 바로 나와요. 키가 없어도 돌아가지만, 그러면 개봉일을 "첫 상영일"로 추정하고 감독·국가·장르와 개봉 예정작(상영관 미정)이 빠져요.

### 2. GitHub 저장소 만들기

GitHub에서 새 저장소를 **Public(공개)** 으로 만들어요. 무료 계정은 공개 저장소만 GitHub Pages를 쓸 수 있어요. 공개라도 주소를 아는 사람만 들어올 수 있고, 담기는 건 영화 일정뿐이에요.

### 3. 파일 올리기

이 폴더 안의 파일을 전부 저장소에 올려요. Git을 쓴다면:

```bash
git init && git add . && git commit -m "처음 올림"
git branch -M main
git remote add origin https://github.com/<아이디>/<저장소이름>.git
git push -u origin main
```

웹에서 끌어다 올릴 때는 숨김 폴더 `.github`가 빠지기 쉬워요(맥 Finder에서는 Cmd+Shift+. 로 보이게 할 수 있어요). 빠졌다면 저장소에서 Add file → Create new file을 누르고 파일 이름 칸에 `.github/workflows/update.yml`을 입력한 뒤 내용을 붙여넣으면 돼요.

### 4. KOBIS 키 등록

저장소 Settings → Secrets and variables → Actions → New repository secret
- Name: `KOBIS_KEY`
- Secret: 발급받은 키

### 5. 사이트 켜기

저장소 Settings → Pages → Build and deployment
- Source: Deploy from a branch
- Branch: `main`, 폴더: `/docs` → Save

### 6. 첫 실행

저장소 Actions 탭 → 왼쪽 "개봉 달력 업데이트" → Run workflow. 5~10분 뒤 사이트 주소로 들어가면 돼요.

```
https://<아이디>.github.io/<저장소이름>/
```

그다음부터는 매일 새벽 자동으로 갱신돼요.


## 첫 실행 뒤 꼭 확인할 것

극장 3사는 공식 API가 없어서 각 사이트 예매 화면이 쓰는 주소로 정보를 받아요. GitHub Actions는 해외 서버에서 돌기 때문에, 극장 사이트가 해외 접속을 막으면 그 체인만 실패할 수 있어요. 첫 실행 로그(Actions 탭 → 실행 기록 → "극장 일정 수집")에서 각 줄을 확인하세요.

```
✓ cgv: 극장 30곳, 1520건
✗ megabox: HTTP 403
```

- 체인 하나가 실패해도 나머지는 정상 저장되고, 사이트 상단에 "○○ 정보를 받지 못해 이전 정보를 보여주고 있어요"라고 떠요.
- 실패가 있으면 Actions 실행이 빨간색으로 표시되고, GitHub 설정에 따라 이메일 알림이 와요.
- 특정 체인이 매일 막힌다면 내 컴퓨터에서 `node scripts/update.mjs`를 실행하고 결과를 push하는 방식으로 바꿀 수 있어요(Node.js 20 이상 필요, KOBIS 키는 `KOBIS_KEY=키 node scripts/update.mjs`처럼 넘김).
- 저장 단계에서 권한 오류가 나면 Settings → Actions → General → Workflow permissions를 "Read and write permissions"로 바꿔요.


## 개봉/재개봉 판정 방식

매일 오늘부터 8일치 상영 시간표를 극장별로 확인하고, 어제까지의 기록과 비교해요.

- **개봉**: 처음 보이는 영화이고 KOBIS 개봉일이 최근이면 KOBIS 개봉일에 표시해요. KOBIS에서 못 찾으면 서울 극장 첫 상영일로 표시해요.
- **재개봉**: 제목에 "재개봉"이 붙어 있거나, KOBIS에 1년 이상 전 개봉 기록이 있거나, 제작연도가 4년 이상 오래됐거나, 이 달력에서 한동안(45일) 안 보이다가 다시 걸린 영화예요. 날짜는 서울 극장 첫 상영일이에요.
- **상영관 미정**: KOBIS에 45일 안에 개봉 예정으로 잡혀 있지만 아직 서울 극장 시간표에 없는 영화예요. 시간표가 열리면 극장 목록이 채워져요. 성인물 장르와 단편은 뺐어요.
- **처음 켠 날**: 그 전부터 상영 중이던 영화는 날짜가 정확하지 않을 수 있어서 사이트에 따로 표시돼요.
- 체인마다 다른 제목 표기(IMAX·4DX·자막·더빙·괄호 등)는 하나로 묶어요. "생중계", "라이브뷰잉"이 들어간 상영물은 빼요.


## 설정 바꾸기 (`config.json`)

| 항목 | 기본값 | 뜻 |
| --- | --- | --- |
| `scanDays` | 8 | 오늘부터 며칠치 시간표를 볼지 |
| `upcomingDays` | 45 | KOBIS 개봉 예정작을 며칠 앞까지 넣을지 |
| `keepDaysAfterRelease` | 120 | 상영이 끝난 영화를 개봉일 기준 며칠까지 남길지 |
| `reappearGapDays` | 45 | 며칠 동안 안 보이다 다시 걸리면 재개봉으로 볼지 |
| `concurrency`, `delayMs` | 3, 250 | 동시 요청 수와 요청 간격(극장 사이트 부담 줄이기) |
| `relayBase`, `relayConcurrency`, `relayDelayMs` | daiso 중계, 2, 2000 | 해외 서버에서 막힌 극장을 우회할 때 쓰는 중계 주소와 요청 속도 |
| `excludeKeywords` | 생중계 등 | 제목에 이 말이 있으면 제외 |
| `dtryxTheaters` | 서울 7곳 | 디트릭스로 예매하는 독립·예술영화관 목록 |


## 지금 포함된 극장과 빠진 곳

- **CGV, 롯데시네마, 메가박스**: 서울 지점 전체(각 사이트의 지역 분류 기준). 아트하우스·아르떼·필름소사이어티 같은 예술 상영관도 지점에 포함돼요.
- **독립·예술영화관**: 디트릭스 예매를 쓰는 곳 중 코드가 확인된 서울 7곳(더숲아트시네마, 아트하우스모모, 에무시네마, 라이카시네마, 아리랑시네센터, 낭만극장, 허리우드클래식).
- **아직 빠진 곳**: 씨네큐브, 인디스페이스, 아트나인, 필름포럼, 서울아트시네마, KU시네마테크, KOFA, 씨네큐. 각자 예매 시스템이 달라서 하나씩 추가해야 해요.


## 폴더 구성

```
.github/workflows/update.yml   매일 자동 실행 설정
config.json                    설정
scripts/update.mjs             수집 → 판정 → 저장
scripts/sources/               극장·KOBIS별 수집 코드
scripts/lib/merge.mjs          개봉/재개봉 판정
scripts/mock/                  샘플 데이터(테스트용)
docs/index.html                달력 사이트
docs/data/films.json           매일 갱신되는 데이터
```

사이트 주소 끝에 `?sample`을 붙이면 지어낸 제목으로 만든 샘플 데이터(`docs/data/sample.json`)로 화면을 볼 수 있어요. 샘플을 새로 만들려면 `npm run mock`을 실행하세요.

## 알아둘 점

- 극장 3사와 디트릭스 조회 주소는 공식 공개 API가 아니라 각 사이트가 내부적으로 쓰는 주소예요. 사이트가 개편되면 바뀔 수 있고, 그때는 `scripts/sources/`의 해당 파일을 고쳐야 해요. 요청 방식은 MIT 라이선스 오픈소스 프로젝트 [daiso-mcp](https://github.com/hmmhmmhm/daiso-mcp)의 구현을 참고했어요.
- GitHub 서버(해외)에서는 CGV·메가박스·디트릭스 접속이 막힐 수 있어요. 그러면 자동으로 공개 중계 API(daiso-mcp 운영자가 무료로 여는 `mcp.aka.page`)를 거쳐 다시 조회해요. 로그에 `cgv(중계)`처럼 표시돼요. 다른 사람이 운영하는 무료 서비스라 언젠가 멈추거나 바뀔 수 있고, 그러면 해당 체인만 다시 실패로 표시돼요.
- 하루 한 번, 요청 사이에 간격을 두고 개인 용도로 쓰는 걸 전제로 만들었어요. 사이트를 널리 공개하거나 다른 서비스에 쓰려면 각 극장 이용약관을 먼저 확인하세요.
- 정확한 시간표와 예매는 각 극장에서 확인하세요.
