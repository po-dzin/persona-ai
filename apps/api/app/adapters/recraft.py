from app.adapters.mock_provider import MockPhotoProvider


class RecraftAdapter(MockPhotoProvider):
    def __init__(self) -> None:
        super().__init__(provider_id="recraft")
