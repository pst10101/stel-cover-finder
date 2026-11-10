# 스텔라이브 커버곡 총정리

스텔라이브 멤버 커버곡을 **곡명 · 원곡자 · 멤버 · 날짜**로 찾아보는 비공식 팬사이트예요.

👉 **https://stelcover.sbk-dev.com**

## 이런 걸 할 수 있어요

- 곡명, 원곡자, 멤버 이름으로 검색
- 멤버 · 종류(개인/협동/3D 라이브/쇼츠/플레이리스트)로 거르기. 종류는 한 곡에 여러 개 붙을 수 있어요 (3D 라이브 + 쇼츠)
- 최신순 · 오래된순 · 곡명순 · 원곡자순 정렬
- 곡명을 누르면 유튜브 원본 영상으로 이동
- 검색한 상태가 주소에 남아서 링크로 그대로 공유할 수 있어요

## 정보는 어디서 오나요

- **유튜브**: 멤버 메인 채널과 공식 채널의 공개 업로드 목록 (YouTube Data API). 제목이 커버처럼 보이는 영상만 골라요
- 6시간마다 새 영상을 확인하고, 일주일에 한 번 전체를 다시 확인해서 지워진 영상을 정리해요
- 곡명 · 원곡자는 영상 제목과 설명에서 자동으로 뽑아요. 틀린 건 `curated.json`에 영상 ID로 적어서 바로잡아요
- 처음 넣어 둔 목록(`curated.json`)의 곡명 · 원곡자는 나무위키 멤버 음악 문서를 참고해서 정리했어요
- 영상이나 썸네일은 저장하지 않아요. 목록 정보만 모아서 **원본 영상으로 연결**해요

## 처음 설정

1. 저장소 **Settings → Secrets and variables → Actions → Secrets**에 `YOUTUBE_API_KEY` 추가 (YouTube Data API v3 키. `YTAPI`라는 이름으로 넣어도 인식해요)
2. 같은 화면 **Variables**에 `USE_GITHUB_PAGES` = `true` 추가, **Settings → Pages → Source**를 **GitHub Actions**로
3. **Actions → update → Run workflow** 한 번 실행 (처음에는 채널 전체를 훑어요)

다시보기 사이트와 같은 API 키를 쓰면 하루 한도(10,000)를 나눠 써요. 이 저장소는 한 번 실행에 최대 2,000까지만 쓰도록 막아 뒀고(`YOUTUBE_QUOTA_BUDGET`), 평소에는 실행당 20~30 정도예요.

## 손으로 고치기

| 하고 싶은 것 | 고칠 곳 |
|---|---|
| 곡명 · 원곡자 · 작곡 · 멤버 · 종류 바로잡기 | `curated.json`의 `videos`에 `"영상ID": {"t": "곡명", "o": "원곡자", ...}` |
| 커버가 아닌 영상 빼기 | `curated.json`에 `"영상ID": {"hide": true}` |
| 제목에 cover가 없어서 안 잡히는 영상 넣기 | `curated.json`에 `d`(공개일) · `t` · `m`까지 적기 |
| 멤버 · 채널 추가 | `members.json` (새 채널이 있으면 푸시하자마자 수집해요) |

고쳐서 main에 올리면 사이트가 바로 다시 만들어져요.

## 지키는 것

- 비공식 · 비상업 팬사이트예요. 스텔라이브, YouTube와 관계없어요
- 광고 없음, 방문자 추적 · 분석 없음
- 스텔라이브 공식 로고나 이미지를 쓰지 않아요

## 문의 · 삭제 요청

잘못된 정보나 내려야 할 내용이 있으면 [Issues](https://github.com/pst10101/stel-cover-finder/issues)에 남겨주세요.

## 코드

```
docs/          사이트 (검색 화면)
scripts/       유튜브 수집 · 제목 정리 · 사이트 데이터 만들기
data/          수집된 목록 (자동 갱신)
members.json   멤버와 유튜브 채널
curated.json   손으로 다듬은 곡 정보
test/          제목 파서 테스트, 가짜 API 서버
```

로컬에서 돌려 보기:

```
node test/parse.test.mjs                       # 제목 파서 테스트
YOUTUBE_API_KEY=... node scripts/fetch-youtube.mjs --full
node scripts/build.mjs
npx serve docs                                 # 또는 아무 정적 서버
```
