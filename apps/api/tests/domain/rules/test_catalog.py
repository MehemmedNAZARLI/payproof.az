import re

import pytest

from payproof.domain.rules.catalog import CATEGORIES, TITLES
from tests.domain.test_enums import ROOT

AZ = (ROOT.parents[1] / "packages/api-client/src/i18n/az.ts").read_text()


def _ts_map(name: str) -> dict[str, str]:
    block = AZ.split(f"export const {name} = {{")[1].split("}")[0]
    return dict(re.findall(r'"(R-0\d\d)": "([^"]+)"', block))


@pytest.mark.parametrize(("ours", "ts_name"), [(TITLES, "ruleTitle"), (CATEGORIES, "ruleCategory")])
def test_same_text_as_the_web_client(ours: dict[str, str], ts_name: str) -> None:
    theirs = {k: v for k, v in _ts_map(ts_name).items() if k != "R-010"}  # R-010 = status
    assert ours == theirs
