from app.adapters.mock_provider import MockPhotoProvider


class OpenAIImageAdapter(MockPhotoProvider):
    def __init__(self) -> None:
        super().__init__(provider_id="openai_image")
