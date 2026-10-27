package com.lonezsi.jqzz.config;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.StashKind;

/**
 * Hibernate guards an enum column with a CHECK on the values it knew then,
 * either by position (action.phase: BETWEEN 0 AND 6) or by name
 * (stash_item.kind: IN ('QUIZ', ...)), and ddl-auto=update never widens it.
 * A database made before a new value refuses to store it, so at startup an
 * outdated check goes. The enums in the code keep the values honest.
 */
@Component
class SchemaFixes implements ApplicationRunner {

    /** table.column -> the enum stored there */
    private static final Map<String, Class<? extends Enum<?>>> ENUMS = Map.of(
            "ACTION.PHASE", Phase.class,
            "QUESTION.TYPE", QuestionType.class,
            "STASH_ITEM.KIND", StashKind.class,
            "STASH_ITEM.VISIBILITY", ImageVisibility.class);

    private static final Pattern RANGE = Pattern.compile("BETWEEN 0 AND (\\d+)");

    private final JdbcTemplate jdbc;

    SchemaFixes(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Map<String, Object>> checks = jdbc.queryForList("""
                    SELECT DISTINCT ccu.TABLE_NAME, ccu.COLUMN_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
                    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
                    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                      ON ccu.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND ccu.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
                    """);
            for (Map<String, Object> row : checks) {
                String table = String.valueOf(row.get("TABLE_NAME"));
                String column = String.valueOf(row.get("COLUMN_NAME"));
                Class<? extends Enum<?>> type = ENUMS.get((table + "." + column).toUpperCase());
                if (type == null || !outdated(String.valueOf(row.get("CHECK_CLAUSE")), type)) continue;
                String name = String.valueOf(row.get("CONSTRAINT_NAME"));
                jdbc.execute("ALTER TABLE \"" + table + "\" DROP CONSTRAINT \"" + name + "\"");
                System.out.println("schema: dropped the outdated check " + name + " on " + table + "." + column);
            }
        } catch (DataAccessException e) {
            // not H2, or nothing to fix: the app works the same either way
            System.err.println("schema: could not look for outdated checks: " + e.getMessage());
        }
        widenEnumColumns();
    }

    /**
     * Newer Hibernate writes a string enum as H2's own ENUM type, which lists
     * its values in the column itself. A value added since (StashKind.TYPE)
     * needs the column redeclared with the whole list, sorted the way
     * Hibernate writes it.
     */
    private void widenEnumColumns() {
        for (Map.Entry<String, Class<? extends Enum<?>>> e : ENUMS.entrySet()) {
            String[] tc = e.getKey().split("\\.");
            try {
                List<String> type = jdbc.queryForList(
                        "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND COLUMN_NAME = ?",
                        String.class, tc[0], tc[1]);
                if (type.isEmpty() || !"ENUM".equalsIgnoreCase(type.get(0))) continue;
                List<String> have = jdbc.queryForList("""
                        SELECT ev.VALUE_NAME FROM INFORMATION_SCHEMA.ENUM_VALUES ev
                        JOIN INFORMATION_SCHEMA.COLUMNS c
                          ON c.TABLE_SCHEMA = ev.OBJECT_SCHEMA AND c.TABLE_NAME = ev.OBJECT_NAME
                         AND c.DTD_IDENTIFIER = ev.ENUM_IDENTIFIER
                        WHERE ev.OBJECT_TYPE = 'TABLE' AND c.TABLE_NAME = ? AND c.COLUMN_NAME = ?
                        """, String.class, tc[0], tc[1]);
                List<String> want = Arrays.stream(e.getValue().getEnumConstants()).map(Enum::name).sorted().toList();
                if (have.containsAll(want)) continue;
                String list = String.join(", ", want.stream().map(v -> "'" + v + "'").toList());
                jdbc.execute("ALTER TABLE \"" + tc[0] + "\" ALTER COLUMN \"" + tc[1] + "\" ENUM(" + list + ")");
                System.out.println("schema: " + e.getKey() + " now takes " + want);
            } catch (DataAccessException ex) {
                System.err.println("schema: could not widen " + e.getKey() + ": " + ex.getMessage());
            }
        }
    }

    /** Does the check leave out a value the enum has now? */
    private static boolean outdated(String clause, Class<? extends Enum<?>> type) {
        Enum<?>[] values = type.getEnumConstants();
        Matcher m = RANGE.matcher(clause);
        if (m.find()) return Integer.parseInt(m.group(1)) < values.length - 1;
        return Arrays.stream(values).anyMatch(v -> !clause.contains("'" + v.name() + "'"));
    }
}
