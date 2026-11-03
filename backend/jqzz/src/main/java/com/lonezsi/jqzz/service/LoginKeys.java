package com.lonezsi.jqzz.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lonezsi.jqzz.model.LoginKey;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.LoginKeyRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.util.IdGenerator;

/**
 * Login keys, kept the way passwords should be: only their hash is stored, so a
 * copy of the database opens no account. The key itself exists in two places,
 * the browser that holds it and the response that first hands it over.
 *
 * Plain SHA-256, no salt and no slow rounds, on purpose. Those protect things
 * people choose, which can be guessed; a key is 32 random characters (about 165
 * bits), so there's nothing to guess, and an unsalted hash can be looked up
 * directly, which every request needs.
 */
@Service
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LoginKeys implements ApplicationRunner {

    private final LoginKeyRepository keys;
    private final UserRepository users;

    public LoginKeys(LoginKeyRepository keys, UserRepository users) {
        this.keys = keys;
        this.users = users;
    }

    public static String hash(String key) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is missing", e);
        }
    }

    /** whose key this is, if anyone's */
    public Optional<String> owner(String key) {
        if (key == null || key.isBlank()) return Optional.empty();
        return keys.findById(hash(key.trim())).map(LoginKey::getUserId);
    }

    /** a new way in, besides any it already has; the key is returned here and never again */
    @Transactional
    public String issue(String userId) {
        String key = IdGenerator.loginKey();
        keys.save(new LoginKey(hash(key), userId));
        return key;
    }

    /** one new key, and every older one stops working */
    @Transactional
    public String replaceAll(String userId) {
        forget(userId);
        return issue(userId);
    }

    @Transactional
    public void forget(String userId) {
        List<LoginKey> mine = keys.findByUserId(userId);
        keys.deleteAll(mine);
    }

    public boolean has(String userId) {
        return keys.existsByUserId(userId);
    }

    /** Keys kept in the clear by an older version move here, hashed, once. */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int moved = 0;
        for (User u : users.findAll()) {
            String old = u.getLoginKey();
            if (old == null) continue;
            String h = hash(old);
            if (!keys.existsById(h)) keys.save(new LoginKey(h, u.getId()));
            u.setLoginKey(null);
            users.save(u);
            moved++;
        }
        if (moved > 0) System.out.println("login keys: hashed " + moved + " kept in the clear");
    }
}
