package com.lonezsi.jqzz.game;

import java.util.List;
import java.util.Locale;

import com.lonezsi.jqzz.model.QuestionType;

/**
 * What a question is (docs/script.md): what players do, its ask, and how that
 * scores, its score. Any pair the ask allows plays; the stored QuestionType is
 * only the name of a common pair, kept for questions saved before modes.
 */
public record Mode(Ask ask, Score score) {

    public enum Ask {
        PICK, PICK_MANY, TYPE_IN, ORDER, NUMBER, MATCH, RANK, WRITE, DRAW, CHAIN, PERSON;

        /** the scores it can take, the first when none is said */
        public List<Score> scores() {
            return switch (this) {
                case PICK -> List.of(Score.RIGHT, Score.CROWD, Score.NONE, Score.VOTES);
                case PICK_MANY -> List.of(Score.RIGHT, Score.NONE);
                case TYPE_IN, ORDER, MATCH -> List.of(Score.RIGHT);
                case NUMBER -> List.of(Score.RIGHT, Score.CROWD);
                case RANK -> List.of(Score.CROWD, Score.NONE);
                case WRITE, DRAW -> List.of(Score.VOTES, Score.AUTHORS, Score.SECRET, Score.KNOCKOUT, Score.NONE);
                case CHAIN -> List.of(Score.NONE);
                case PERSON -> List.of(Score.RIGHT, Score.NONE);
            };
        }

        public String key() {
            return name().toLowerCase(Locale.ROOT).replace('_', '-');
        }
    }

    public enum Score {
        RIGHT, CROWD, VOTES, AUTHORS, SECRET, KNOCKOUT, NONE;

        public String key() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    public Mode {
        if (ask == null) ask = Ask.PICK;
        if (score == null || !ask.scores().contains(score)) score = ask.scores().get(0);
    }

    /** the pair a stored type always meant */
    public static Mode of(QuestionType type) {
        if (type == null) return new Mode(Ask.PICK, Score.RIGHT);
        return switch (type) {
            case PREWRITTEN_SINGLE -> new Mode(Ask.PICK, Score.RIGHT);
            case PREWRITTEN_MULTIPLE -> new Mode(Ask.PICK_MANY, Score.RIGHT);
            case TYPED -> new Mode(Ask.TYPE_IN, Score.RIGHT);
            case ORDER -> new Mode(Ask.ORDER, Score.RIGHT);
            case NUMBER -> new Mode(Ask.NUMBER, Score.RIGHT);
            case MATCH -> new Mode(Ask.MATCH, Score.RIGHT);
            case POLL -> new Mode(Ask.PICK, Score.CROWD);
            case TIERLIST -> new Mode(Ask.RANK, Score.CROWD);
            case USER_GENERATED -> new Mode(Ask.WRITE, Score.NONE);
            case USER_GENERATED_VOTE -> new Mode(Ask.WRITE, Score.VOTES);
            case USER_GENERATED_IDENTIFY -> new Mode(Ask.WRITE, Score.AUTHORS);
            case KNOCKOUT_BATTLE -> new Mode(Ask.WRITE, Score.KNOCKOUT);
            case DRAW -> new Mode(Ask.DRAW, Score.NONE);
            case DRAW_VOTE -> new Mode(Ask.DRAW, Score.VOTES);
            case DRAW_GUESS -> new Mode(Ask.DRAW, Score.SECRET);
            case DRAW_BATTLE -> new Mode(Ask.DRAW, Score.KNOCKOUT);
            case TELEPHONE -> new Mode(Ask.CHAIN, Score.NONE);
        };
    }

    /** "draw/votes" as a question stores it; without one (or one that makes no sense), what the type meant */
    public static Mode parse(String text, QuestionType fallback) {
        if (text != null && !text.isBlank()) {
            String[] parts = text.trim().toUpperCase(Locale.ROOT).replace('-', '_').split("/", 2);
            try {
                Ask ask = Ask.valueOf(parts[0]);
                Score score = parts.length > 1 ? Score.valueOf(parts[1]) : null;
                return new Mode(ask, score);
            } catch (IllegalArgumentException e) {
                // fall through to the type
            }
        }
        return of(fallback);
    }

    public String key() {
        return ask.key() + "/" + score.key();
    }

    /** players make the entries (written or drawn) that go on the board */
    public boolean entries() {
        return ask == Ask.WRITE || ask == Ask.DRAW;
    }

    /** voting, guessing or battles happen during the reveal; a pick that borrows earlier answers is voted on while it's asked */
    public boolean judged() {
        return (score == Score.VOTES && ask != Ask.PICK) || score == Score.AUTHORS || score == Score.SECRET || score == Score.KNOCKOUT;
    }

    /** the "speed" setting counts */
    public boolean speedy() {
        return score == Score.RIGHT && List.of(Ask.PICK, Ask.PICK_MANY, Ask.TYPE_IN, Ask.ORDER, Ask.NUMBER, Ask.MATCH).contains(ask);
    }
}
