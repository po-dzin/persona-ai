import type {
  GeneratePayloadDto,
  StyleDto,
  UserProfileDto,
} from "../../../../shared/contracts/dto";
import type {
  GenerateRequest,
  Style,
  UserProfile,
} from "../../../../shared/contracts/domain";
import {
  UI_SCREENS,
  UI_SOURCE_TABS,
  type BaseScreen,
  type SourceTab,
} from "../../../../shared/contracts/ui";
import {
  mapGenerateRequestToDto,
  mapStyleDto,
  mapUserProfileDto,
} from "../utils/mappers";

type IsExact<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

type Assert<T extends true> = T;

const styleDto: StyleDto = {
  id: "hollywood",
  name: "Hollywood",
  category: "Тренды",
  gradient: "linear-gradient(#111,#222)",
  prompt_template: "studio portrait",
  is_trending: true,
  is_new: false,
};

const styleDomain = mapStyleDto(styleDto);
const _styleTypeIsDomain: Assert<IsExact<typeof styleDomain, Style>> = true;

const generateRequest: GenerateRequest = {
  userId: "u-1",
  sourceKey: "uploads/a.jpg",
  modelId: "nb2-1k",
  styleCode: "hollywood",
  prompt: "studio portrait",
  aspectRatio: "1:1",
};

const generatePayloadDto = mapGenerateRequestToDto(generateRequest);
const _requestMapsToDto: Assert<IsExact<typeof generatePayloadDto, GeneratePayloadDto>> = true;

const profileDto: UserProfileDto = {
  user_id: "u-1",
  first_name: "G",
  username: "g_user",
  paid_credits: 20,
  generations_count: 5,
  referrals_count: 1,
  is_admin: false,
};

const profileDomain = mapUserProfileDto(profileDto);
const _profileTypeIsDomain: Assert<IsExact<typeof profileDomain, UserProfile>> = true;

const screen: BaseScreen = UI_SCREENS.HOME;
const sourceTab: SourceTab = UI_SOURCE_TABS.STYLES;
void screen;
void sourceTab;

const invalidDomainStyle: Style = {
  id: "hollywood",
  name: "Hollywood",
  category: "Тренды",
  gradient: "linear-gradient(#111,#222)",
  // @ts-expect-error Domain models must remain camelCase.
  prompt_template: "studio portrait",
};
void invalidDomainStyle;

const invalidDtoPayload: GeneratePayloadDto = {
  // @ts-expect-error DTO contracts must remain snake_case.
  userId: "u-1",
  sourceKey: "uploads/a.jpg",
  modelId: "nb2-1k",
  styleCode: "hollywood",
};
void invalidDtoPayload;
