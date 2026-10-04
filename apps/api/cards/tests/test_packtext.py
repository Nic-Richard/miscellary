from cards import packtext


def test_text_style_flags_are_booleans():
    styled = {"text": "Hi", "bold": True, "italic": False, "underline": True}
    assert packtext.problems([styled]) == []
    assert packtext.problems([{"text": "Hi", "bold": "yes"}]) == [
        "Line 1 needs bold as true or false."
    ]


def test_text_styles_default_off():
    (layer,) = packtext.normalised([{"text": "Hi"}])
    assert (layer["bold"], layer["italic"], layer["underline"]) == (False, False, False)
