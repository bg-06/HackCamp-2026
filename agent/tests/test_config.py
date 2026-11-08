from block_steward.config import load_settings


def _write(tmp_path, name, text):
    (tmp_path / name).write_text(text, encoding="utf-8")


def test_defaults(tmp_path):
    s = load_settings(root=tmp_path, environ={})
    assert s.sink == "dry-run"
    assert s.auth0_audience == "https://api.blockbyblock"
    assert s.gemini_model == "gemini-2.5-flash"
    assert s.postgres_sslmode == "require"
    assert s.areas is None
    assert s.gemini_api_key is None


def test_reads_env_file_with_comments_and_quotes(tmp_path):
    _write(tmp_path, "env", "# note\nPOSTGRES_HOST=db.example\nPOSTGRES_PORT=5433\n"
                            "POSTGRES_DB='hc'\n\nAGENT_AREAS=Mount Pleasant, Strathcona\n")
    s = load_settings(root=tmp_path, environ={})
    assert s.postgres_host == "db.example"
    assert s.postgres_port == 5433
    assert s.postgres_db == "hc"
    assert s.areas == ["Mount Pleasant", "Strathcona"]


def test_dotenv_also_read_and_env_file_wins_over_dotenv(tmp_path):
    _write(tmp_path, "env", "POSTGRES_HOST=from-env\n")
    _write(tmp_path, ".env", "POSTGRES_HOST=from-dotenv\nPOSTGRES_USER=u\n")
    s = load_settings(root=tmp_path, environ={})
    assert s.postgres_host == "from-env"
    assert s.postgres_user == "u"


def test_environment_wins_over_files(tmp_path):
    _write(tmp_path, "env", "POSTGRES_HOST=from-file\nAGENT_SINK=dry-run\n")
    s = load_settings(root=tmp_path, environ={"POSTGRES_HOST": "from-os", "AGENT_SINK": "http"})
    assert s.postgres_host == "from-os"
    assert s.sink == "http"


def test_empty_values_fall_back_to_defaults(tmp_path):
    _write(tmp_path, "env", "AUTH0_AUDIENCE=\nGEMINI_API_KEY=\nAGENT_AREAS=\n")
    s = load_settings(root=tmp_path, environ={})
    assert s.auth0_audience == "https://api.blockbyblock"
    assert s.gemini_api_key is None
    assert s.areas is None


def test_repr_hides_secrets(tmp_path):
    s = load_settings(root=tmp_path, environ={"POSTGRES_PASSWORD": "hunter2",
                                              "GEMINI_API_KEY": "gkey123",
                                              "AUTH0_CLIENT_SECRET": "sec456"})
    text = repr(s) + str(s)
    for secret in ("hunter2", "gkey123", "sec456"):
        assert secret not in text


def test_env_file_with_utf8_bom(tmp_path):
    (tmp_path / "env").write_bytes(b"\xef\xbb\xbfPOSTGRES_HOST=bom.example\nPOSTGRES_DB=x\n")
    s = load_settings(root=tmp_path, environ={})
    assert s.postgres_host == "bom.example"
