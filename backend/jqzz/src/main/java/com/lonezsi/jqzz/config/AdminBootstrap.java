package com.lonezsi.jqzz.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.LoginKeys;
import com.lonezsi.jqzz.util.AdminSecret;
import com.lonezsi.jqzz.util.IdGenerator;

/**
 * Makes the admin account the first time the server starts without one. Its
 * login key and the answer to its second question are written once, to a file
 * next to the database, and never anywhere else: not the log, not the API.
 * Whoever runs the server reads them there and deletes the file.
 *
 * Lost them? Put an empty file named ADMIN-RESET next to the database and
 * restart: both are made again and the file is written again.
 */
@Component
class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final LoginKeys keys;
    private final boolean enabled;
    private final Path dir;

    AdminBootstrap(UserRepository users, LoginKeys keys,
            @Value("${jqzz.admin.bootstrap:true}") boolean enabled,
            @Value("${jqzz.admin.dir:./data}") String dir) {
        this.users = users;
        this.keys = keys;
        this.enabled = enabled;
        this.dir = Path.of(dir);
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (!enabled) return;
        Path reset = dir.resolve("ADMIN-RESET");
        User admin = users.findFirstByAdminTrue().orElse(null);
        if (admin != null && !Files.exists(reset)) return;

        if (admin == null) {
            admin = new User();
            admin.setId(IdGenerator.generateId());
            admin.setHandle("admin-" + IdGenerator.random(6));
            admin.setName("Admin");
            admin.setAdmin(true);
        }
        String answer = AdminSecret.answer();
        admin.setAdminAnswer(AdminSecret.hash(answer));
        users.save(admin);
        String key = keys.replaceAll(admin.getId());

        Files.createDirectories(dir);
        Path file = dir.resolve("ADMIN-CREDENTIALS.txt");
        Files.writeString(file, String.join(System.lineSeparator(),
                "JQZZ admin account",
                "",
                "1. Log in with this login key:",
                "   " + key,
                "",
                "2. Open #/admin. When it asks for the name of your first pet, answer:",
                "   " + answer,
                "",
                "Keep both somewhere safe (a password manager), then delete this file.",
                "Lost them? Put an empty file named ADMIN-RESET here and restart the server.",
                ""), StandardCharsets.UTF_8);
        Files.deleteIfExists(reset);
        log.warn("Admin account ready. Its login details are in {}: read them, then delete the file.",
                file.toAbsolutePath().normalize());
    }
}
