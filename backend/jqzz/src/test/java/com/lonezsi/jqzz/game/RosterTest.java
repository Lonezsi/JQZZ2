package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.QuestionType;

/** A quiz's Roster line: who's coming, and everyone joins as one of them. */
class RosterTest {

    private static final Game.QuestionSnap Q = new Game.QuestionSnap(1, "Q", null, QuestionType.PREWRITTEN_SINGLE, null,
            null, List.of(new Game.AnswerSnap(11, "a", null, 100)));

    /** open: whether someone new can join once it's started (latejoin) */
    private static Game game(boolean open, String... roster) {
        Game g = new Game("ABCDE", "host", "quiz", List.of(new Game.Step(Phase.QUESTION, 20, Q, open)), new Random(7), 0);
        g.roster = List.of(roster);
        return g;
    }

    private static Game game(String... roster) {
        return game(true, roster);
    }

    private static String name(Game g, String id) {
        return g.players.get(id).name;
    }

    @Test
    void rosterGame_joiningNeedsANameFromTheList() {
        Game g = game("Anna", "Bence");
        assertThatThrownBy(() -> g.addPlayer("u1", "account", null, null, 0))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Pick who you are");
        assertThatThrownBy(() -> g.addPlayer("u1", "account", null, "Zoe", 0))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("That name isn't on the list");
        g.addPlayer("u1", "account", null, "bence", 0);
        assertThat(name(g, "u1")).as("the list's own spelling").isEqualTo("Bence");
    }

    @Test
    void namesAreUniqueByDefault_ignoringCaseAndSpaces() {
        Game g = game("Anna", "Bence Kiss");
        g.addPlayer("u1", "a", null, "Anna", 0);
        assertThatThrownBy(() -> g.addPlayer("u2", "b", null, " anna ", 0))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Anna is already here");
        g.addPlayer("u2", "b", null, "  bence   kiss ", 0);
        assertThat(name(g, "u2")).isEqualTo("Bence Kiss");
        assertThat(Game.nameKey("  Bence   KISS ")).isEqualTo("bence kiss");
    }

    @Test
    void uniqueOff_letsTwoPeopleShareAName() {
        Game g = game("Anna");
        g.uniqueNames = false;
        g.addPlayer("u1", "a", null, "Anna", 0);
        g.addPlayer("u2", "b", null, "ANNA", 0);
        assertThat(g.players.values()).extracting(p -> p.name).containsExactly("Anna", "Anna");
    }

    @Test
    void aRejoinKeepsTheRosterName_notTheAccountName_butTakesTheNewPicture() {
        Game g = game("Anna");
        g.addPlayer("u1", "account", "old.png", "Anna", 0);
        g.addPlayer("u1", "renamed account", "new.png", null, 0);
        assertThat(name(g, "u1")).isEqualTo("Anna");
        assertThat(g.players.get("u1").picture).isEqualTo("new.png");
    }

    @Test
    void aNameIsFreeAgainWhenItsHolderLeavesOrIsRemoved() {
        Game g = game("Anna");
        g.addPlayer("u1", "a", null, "Anna", 0);
        g.removePlayer("u1", 0);
        g.addPlayer("u2", "b", null, "Anna", 0);
        g.kick("u2", 0);
        g.addPlayer("u3", "c", null, "Anna", 0);
        assertThat(name(g, "u3")).isEqualTo("Anna");
    }

    @Test
    void changingWhoYouAre_onlyInTheLobby() {
        Game g = game("Anna", "Bence", "Csilla");
        g.addPlayer("u1", "a", null, "Anna", 0);
        g.addPlayer("u1", "a", null, "Bence", 0);
        assertThat(name(g, "u1")).isEqualTo("Bence");
        g.addPlayer("u2", "b", null, "Anna", 0);
        assertThatThrownBy(() -> g.addPlayer("u1", "a", null, "Anna", 0)).hasMessage("Anna is already here");
        g.start(0);
        assertThatThrownBy(() -> g.addPlayer("u1", "a", null, "Csilla", 0))
                .isInstanceOf(IllegalStateException.class).hasMessage("You can only change who you are before the game starts");
        g.addPlayer("u1", "a", null, "bence", 0); // the same one: nothing changes
        assertThat(name(g, "u1")).isEqualTo("Bence");
    }

    @Test
    void rosterNamesGetInEvenWithTheDoorsClosed() {
        Game g = game(false, "Anna", "Bence");
        g.addPlayer("u1", "a", null, "Anna", 0);
        g.start(0);
        g.addPlayer("u2", "b", null, "Bence", 0);
        assertThat(g.players).containsKeys("u1", "u2");

        Game closed = game(false);
        closed.addPlayer("u1", "a", null, 0);
        closed.start(0);
        assertThatThrownBy(() -> closed.addPlayer("u2", "b", null, 0)).hasMessageContaining("isn't taking new players");
    }

    @Test
    void kicked_staysOut_evenWithAFreeName() {
        Game g = game("Anna", "Bence");
        g.addPlayer("u1", "a", null, "Anna", 0);
        g.kick("u1", 0);
        assertThatThrownBy(() -> g.addPlayer("u1", "a", null, "Bence", 0))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("took you out");
    }

    @Test
    void withoutARoster_joiningIsAsBefore_andTheNameFollowsTheAccount() {
        Game g = game();
        g.addPlayer("u1", "Same", null, 0);
        g.addPlayer("u2", "Same", null, "whatever", 0);
        assertThat(g.players.values()).extracting(p -> p.name).containsExactly("Same", "Same");
        g.addPlayer("u1", "Renamed", "pic.png", 0);
        assertThat(name(g, "u1")).isEqualTo("Renamed");
        assertThat(g.view(0, id -> true)).doesNotContainKey("roster");
    }

    @Test
    @SuppressWarnings("unchecked")
    void theViewListsTheRosterAndWhichNamesAreTaken() {
        Game g = game("Anna", "Bence");
        g.addPlayer("u1", "a", null, "Bence", 0);
        Map<String, Object> roster = (Map<String, Object>) g.view(0, id -> true).get("roster");
        assertThat(roster.get("unique")).isEqualTo(true);
        assertThat(roster.get("names")).isEqualTo(List.of(
                Map.of("name", "Anna", "taken", false),
                Map.of("name", "Bence", "taken", true)));
    }

    @Test
    void whoPlayed_outlivesLeaving() {
        Game g = game("Anna", "Bence");
        g.addPlayer("u1", "a", null, "Anna", 0);
        g.start(0);
        g.addPlayer("u2", "b", null, "Bence", 0);
        g.removePlayer("u1", 0);
        assertThat(g.played).containsEntry("u1", "Anna").containsEntry("u2", "Bence");
        assertThat(g.knownName("u1")).isEqualTo("Anna");
        assertThat(g.knownName("nobody")).isEqualTo("someone who left");
    }
}
