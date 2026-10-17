# 현재 에셋 — gacha-game 원본 이식

사용자 요청에 따라 [y3ssam/gacha-game](https://github.com/y3ssam/gacha-game)의 원본 PNG 11장을 `assets/reference/`에 복사했습니다. 원본 크기·투명도·파일 내용은 변경하지 않았습니다. 출처·SHA-256은 `assets/reference/provenance.json`, 구체적인 연결은 [REFERENCE-IMPORT.md](REFERENCE-IMPORT.md)에 있습니다.

아래 초기 제작 기록의 로비·초상 아틀라스·4종 WebP는 기본 게임 제거와 함께 삭제되었습니다. 현재 실행 화면에서 사용하지 않습니다. SVG 스킬/공용 아이콘은 유지합니다. 사용자 생성 NAI 이미지는 브라우저 저장소에만 저장합니다.

---

## 초기 제작 이력 (삭제된 기본 삽화 포함)

# 기본 에셋 제작 기록

2026-10-17. 래스터 이미지는 내장 image generation 도구로 제작했습니다. UI 목업을 잘라 쓰지 않고 실제 배경·초상·던전 에셋으로 연결했습니다. 생성 후 WebP로 변환했으며 던전 아틀라스는 네 영역으로 잘랐습니다. 사용자별 NAI 생성 이미지는 이 폴더에 커밋하지 않습니다.

| 파일 | 용도 | 제작 |
| --- | --- | --- |
| `assets/lobby.webp` | 기본 세계 로비·기본 전투/시나리오 배경 | 이미지 생성 |
| `assets/characters.webp` | 아엘·세나·린·노아 4명 초상 아틀라스 | 이미지 생성 |
| `assets/dungeon-gold.webp` | 골드 던전 | 이미지 생성 아틀라스 1영역 |
| `assets/dungeon-xp.webp` | 기록 던전 | 이미지 생성 아틀라스 2영역 |
| `assets/dungeon-gear.webp` | 장비 던전 | 이미지 생성 아틀라스 3영역 |
| `assets/dungeon-ascend.webp` | 돌파 던전 | 이미지 생성 아틀라스 4영역 |
| `assets/*.svg` | 스킬·재료·장비·에너지·기본 적 아이콘 | 직접 작성한 64×64 SVG |
| `favicon.svg` | 게임 아이콘 | 직접 작성한 SVG |

## 최종 생성 프롬프트

### 로비

Use case: stylized-concept. Asset type: actual background illustration for a polished 2D gacha RPG lobby, landscape 1536x1024. Quiet futuristic observatory inside a monumental white stone orbital station, enormous circular window overlooking distant blue planet and an ocean of clouds, luminous gold astronomical rings suspended around a small dark crystal dais, dark teal marble floor, delicate stars, soft pale blue daylight, restrained cyan and amber light, sophisticated Japanese RPG background painting with precise architecture and painterly detail. Wide playable empty foreground, lower left intentionally dark for readable game overlay. No people, no UI, no lettering, no logos, no cards, no watermark. This is a reusable actual game background asset, not a UI mockup.

### 캐릭터 아틀라스

Use case: stylized-concept. Asset type: four-character portrait atlas for an actual original gacha RPG. Single wide landscape image, four EXACTLY equal-width vertical portrait panels side by side, straight clean boundaries at 25%, 50%, 75%. No gap, no text or borders. Each panel depicts a different adult original character waist-up with head fully visible and a refined dark teal abstract background. Panel 1: adult silver-haired male knight with blue eyes and black white gold tailored futuristic longcoat, sword, composed. Panel 2: adult woman mage with long dark blue hair, turquoise eyes, navy ceremonial coat, cyan floating crystal. Panel 3: adult red-haired woman ranger with amber eyes, dark leather coat, red scarf, mechanical bow. Panel 4: adult blond man healer with glasses, white tailored coat, green luminous medical sigil. Consistent high-quality polished Japanese RPG anime illustration, intricate costume design, strong silhouette, luminous rim light, attractive adult faces. Four separate characters, one per column. No UI, lettering, logos, watermark. This atlas will be cropped into four game character cards.

### 던전 아틀라스

Use case: stylized-concept. Asset type: actual 2x2 dungeon background atlas for Japanese 2D gacha RPG. Landscape canvas divided into EXACTLY four equal rectangular quadrants with clean edges, no frame, no text, no people. Top left ancient abandoned gold vault with bronze arches and golden crystals in deep navy shadows. Top right huge blue library with floating books and luminous memory cubes, moonlight. Bottom left derelict orbital forge with massive anvils and fiery mechanical rings, dark teal iron. Bottom right underground violet crystal cavern and fractured astronomical artifact in pool of blue water. Consistent refined painterly anime game background style, detailed architecture, cinematic atmospheric perspective, deep shadows at bottom of each quadrant for game labels. Four distinct environments, no interface, no lettering, no watermark.
