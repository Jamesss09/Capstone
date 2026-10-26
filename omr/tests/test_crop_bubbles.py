from tools.crop_bubbles import classify


def test_erased_bubble_is_smudge_and_final_mark_is_shaded():
    row = {"marked": "C", "state": "erasure", "erased": "A"}

    assert classify(row, "A") == "erasure_smudge"
    assert classify(row, "C") == "shaded"
    assert classify(row, "B") == "empty"


def test_multiple_erased_letters_are_supported():
    row = {"marked": "D", "state": "erasure", "erased": ["A", "C"]}

    assert classify(row, "A") == "erasure_smudge"
    assert classify(row, "C") == "erasure_smudge"
    assert classify(row, "D") == "shaded"
