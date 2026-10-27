package com.lonezsi.jqzz.config;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.lonezsi.jqzz.model.Phase;

/**
 * Hibernate guards an enum column with a CHECK on the values it knew then
 * (action.phase is stored by position: BETWEEN 0 AND 6), and ddl-auto=update
 * never widens it. A database made before a new phase (SETTING) refuses to
 * store it, so at startup an outdated check goes. The enum keeps the values honest.
 */
@Component
class SchemaFixes implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    SchemaFixes(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Map<String, Object>> checks = jdbc.queryForList("""
                    SELECT DISTINCT ccu.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
                    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
                    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                      ON ccu.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND ccu.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
                    """);
            // phases are stored by position ("PHASE" BETWEEN 0 AND 6), so a
            // check whose top is below the last phase is out of date
            int last = Phase.values().length - 1;
            Pattern range = Pattern.compile("\"PHASE\" BETWEEN 0 AND (\\d+)");
            List<Map<String, Object>> stale = checks.stream()
                    .filter(row -> "ACTION".equalsIgnoreCase(String.valueOf(row.get("TABLE_NAME"))))
                    .filter(row -> {
                        Matcher m = range.matcher(String.valueOf(row.get("CHECK_CLAUSE")));
                        return m.find() && Integer.parseInt(m.group(1)) < last;
                    })
                    .toList();
            for (Map<String, Object> row : stale) {
                String table = String.valueOf(row.get("TABLE_NAME"));
                String name = String.valueOf(row.get("CONSTRAINT_NAME"));
                jdbc.execute("ALTER TABLE \"" + table + "\" DROP CONSTRAINT \"" + name + "\"");
                System.out.println("schema: dropped the outdated phase check " + name + " on " + table);
            }
        } catch (DataAccessException e) {
            // not H2, or nothing to fix: the app works the same either way
            System.err.println("schema: could not look for outdated checks: " + e.getMessage());
        }
    }
}
