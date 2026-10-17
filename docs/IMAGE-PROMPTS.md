# NAI 외형·의상·다중 인물 프롬프트

## 캐릭터 생성

세계 생성 순서는 세계 규칙 → 캐릭터 설정/고정 외형 → 기본 의상 → 적 도감 → 챕터 → 배너입니다. 외형과 의상은 별도 AI 요청·체크포인트입니다. 의상 단계가 실패해도 이미 생성한 얼굴·머리·눈 등을 다시 추첨하지 않습니다.

| 저장 필드 | 내용 |
| --- | --- |
| `naiAppearance.gender` | male / female / other |
| `naiAppearance.maturity` | 성숙도·연령 인상 |
| `naiAppearance.skinTone` | 피부색 |
| `naiAppearance.species` | 종족·귀·꼬리·뿔 등 고정 형질 |
| `naiAppearance.bodyType` | 키·체형 |
| `naiAppearance.hairLength` | 머리 길이 |
| `naiAppearance.hairStyle` | 머리 모양·결 |
| `naiAppearance.bangs` | 앞머리 모양 |
| `naiAppearance.hairColor` | 머리색 |
| `naiAppearance.eyeShape` | 눈 모양 |
| `naiAppearance.eyeColor` | 눈색 |
| `naiAppearance.distinctiveTraits` | 흉터·점·주근깨·안경 등 고유 특징 |
| `identityPrompt` | 위 고정 항목으로 엔진이 조합한 NAI 태그 |
| `outfitPrompt` | 기본 의상·옷 색·소재·신발·장비만 포함한 태그 |

신규 인물은 동일한 외형 전체를 재사용할 수 없습니다. AI에는 확정 설정을 지키면서 서로 구분되는 시각적 특징을 만들도록 지시합니다. 외형 항목에 의상 단어가 들어가거나 의상에 머리/눈/피부 태그가 섞인 일부 명백한 형식 오류는 거부합니다. 자연어의 모든 의미 충돌을 완전히 판정하는 검증기는 아닙니다.

의상 가챠의 `clothingPrompt`도 옷과 액세서리만 포함합니다. 이미지 생성 시 기존 인물의 고정 외형 + 선택한 의상 + 그 인물의 포즈/표정을 한 **개별 캐릭터 프롬프트**로 합칩니다. 기본 외형을 새 의상이 덮어쓰지 않습니다.

주인공도 `world.protagonistVisual`에 별도 외형·의상을 보관합니다. CG에 등장할 경우 `protagonist`라는 ID로 자신의 캐릭터 칸을 사용합니다.

## 여러 인물이 나오는 이미지

스토리 CG와 배너는 다음과 같은 이미지 설계를 사용합니다.

```json
{
  "basePrompt": "observatory hall, evening, cinematic lighting, side-by-side",
  "cast": [
    {
      "characterId": "ael",
      "outfitId": "default",
      "actionPrompt": "holding a book",
      "center": { "x": 0.3, "y": 0.5 }
    },
    {
      "characterId": "rin",
      "outfitId": "default",
      "actionPrompt": "pointing at a map",
      "center": { "x": 0.7, "y": 0.5 }
    }
  ]
}
```

- 공통 프롬프트는 배경·조명·스타일·구도만 담당합니다. 외형과 옷은 각 인물 칸에만 넣습니다.
- `cast`에는 보이는 인물을 각각 등록합니다. 알 수 없는 ID·중복 ID·겹치는 위치·빈 인물 목록은 거부합니다.
- 게임의 이미지당 인원은 최대 6명입니다. 더 많으면 잘라 보내거나 합치지 않고 오류로 처리합니다.
- 인원/성별 수 태그는 실제 등록 인물로 계산하여 공통 프롬프트에 붙입니다. 개별 칸에는 `boy` / `girl` / `other`와 해당 인물의 외형만 들어갑니다.
- 의상은 기본/현재 선택/획득한 의상 ID를 사용할 수 있습니다. 남의 의상이나 미획득 의상 ID는 거부합니다. 신규 캐릭터 배너는 기본 의상을 사용합니다.
- 인물별 부정 프롬프트를 동일 인덱스·위치에 맞추고, 서로 다른 머리색/눈색의 유입을 억제하는 태그를 추가합니다.

실제 NAI 요청에서는 `parameters.v4_prompt.caption.char_captions`에 각 인물의 `char_caption`과 `centers`를 넣습니다. 부정 프롬프트도 `v4_negative_prompt.caption.char_captions`로 구분합니다. `use_coords`와 `use_order`를 사용하며 위치는 5×5 격자 중심에 맞춥니다.

개별 인물 칸을 사용할 수 없는 NAI V3 모델에서는 인물 이미지를 생성하지 않습니다. V4/V4.5/V5 계열을 사용하세요. 이 게임은 호환성을 위해 V5에서도 인원 상한을 6명으로 유지합니다. 환경 배경은 인물 없이, 적 도감 이미지는 한 개체씩 생성합니다.

## 기존 저장과 재시도

- 기존 캐릭터·스킬·재화·획득 의상 ID·이미지는 삭제하지 않습니다.
- 기본 4명의 외형·의상은 코드에 정의한 항목으로 자동 보강합니다.
- 기존 AI 인물은 첫 이미지 생성 또는 캐릭터 상세의 **외형·의상 프롬프트 보강**에서 기존 프로필과 태그를 기반으로 분리합니다. Vertex 호출이 필요합니다.
- 이미 유효한 고정 외형이 있으면 의상만 보강하는 과정에서 외형을 바꾸지 않습니다.
- 예전의 혼합 의상 프롬프트는 의상만 분리해 보강하며 획득 ID와 이미지는 유지합니다.
- 예전 CG/배너는 새로 만들거나 실패 작업을 재시도할 때 개별 인물 설계를 추가합니다. 저장된 시나리오 대사는 바꾸지 않습니다.
- 새 이미지 작업 기록은 공통 프롬프트와 인물별 프롬프트·부정 프롬프트·위치를 함께 보관합니다. 재시도도 동일한 구분을 유지합니다.
- 기존 이미지를 자동으로 다시 생성하지 않습니다. 저장된 이미지 자체가 바뀌려면 재생성 버튼을 눌러야 합니다.

## 검증과 한계

`npm test` 91개 통과. 신규 테스트는 2인 외형/의상 분리, 인원 수 태그, 긍정/부정 슬롯·위치 일치, V3 거부, 혼합 태그 거부, 고정 외형 보존, 기본/선택 의상, 주인공 칸, 이전 저장 보강, 의상 단계 재개를 확인합니다.

실제 NAI 계정으로 이미지를 생성하여 얼굴·특징 유지 정도를 비교한 검증은 수행하지 않았습니다. 개별 캐릭터 칸은 특징 혼합을 줄이는 요청 구조이며 모델이 매번 완벽히 같은 얼굴을 그리는 것을 보장하지는 않습니다.

공식 자료를 확인해 구현했습니다: [NAI 다중 캐릭터 가이드](https://docs.novelai.net/en/image/multiplecharacters/) · [이미지 API 스키마](https://image.novelai.net/docs/doc.json).
