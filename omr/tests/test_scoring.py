import pytest

from core.scoring import ScoringError, expected_item_keys, score_items


def answer_key(
    passing_score: float = 75,
    correct_answer: str = "A",
    points: float = 1,
) -> dict:
    return {
        "id": 9,
        "exam_title": "Entrance Examination",
        "passing_score": passing_score,
        "status": "Active",
        "items": [
            {
                "section": section,
                "item_number": item_number,
                "correct_answer": correct_answer,
                "points": points,
            }
            for section, item_number in expected_item_keys()
        ],
    }


def responses(answer: str = "A") -> list[dict]:
    return [
        {
            "section": section,
            "item_number": item_number,
            "status": "answered",
            "marked_answer": answer,
            "flags": [],
        }
        for section, item_number in expected_item_keys()
    ]


def test_scores_complete_key_and_passes_at_exact_boundary():
    recognized = responses()
    for item in recognized[75:]:
        item["marked_answer"] = "B"

    score = score_items(recognized, answer_key(passing_score=75))

    assert score["score"] == 75.0
    assert score["status"] == "Passed"
    assert score["correct_count"] == 75
    assert score["incorrect_count"] == 25
    assert score["total_items"] == 100
    assert score["earned_points"] == 75
    assert score["total_points"] == 100


def test_blank_invalid_and_low_confidence_answer_scoring():
    recognized = responses()
    recognized[0].update(status="blank", marked_answer=None)
    recognized[1].update(status="invalid", marked_answer=None, flags=["multi_shade"])
    recognized[2]["flags"] = ["low_confidence"]

    score = score_items(recognized, answer_key(passing_score=99))

    assert score["correct_count"] == 98
    assert score["incorrect_count"] == 2
    assert score["blank_count"] == 1
    assert score["invalid_count"] == 1
    assert score["low_confidence_count"] == 1
    assert score["status"] == "Failed"
    assert score["items"][2]["is_correct"] is True


def test_weighted_points_determine_percentage():
    key = answer_key(passing_score=50)
    key["items"][0]["points"] = 100
    recognized = responses(answer="B")
    recognized[0]["marked_answer"] = "A"

    score = score_items(recognized, key)

    assert score["correct_count"] == 1
    assert score["earned_points"] == 100
    assert score["total_points"] == 199
    assert score["score"] == 50.25
    assert score["status"] == "Passed"


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda key: key["items"].pop(), "missing 1 item"),
        (lambda key: key["items"].append(dict(key["items"][0])), "repeats inductive item 1"),
        (
            lambda key: key["items"][10].update(correct_answer="E"),
            "correct_answer must be one of A, B, C, D",
        ),
        (lambda key: key.update(status="Inactive"), "status must be Active"),
    ],
)
def test_rejects_invalid_answer_keys(mutate, message):
    key = answer_key()
    mutate(key)

    with pytest.raises(ScoringError, match=message):
        score_items(responses(), key)
