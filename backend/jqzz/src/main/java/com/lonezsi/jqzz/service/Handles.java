package com.lonezsi.jqzz.service;

import org.springframework.stereotype.Component;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;

/**
 * Shared references name their owner by handle ("handle:name"), never by id:
 * an id is what logs you in, so it must not travel in a link or a copied
 * reference. Models build their reference while being written out, so the
 * lookup is reachable statically once Spring has made this.
 */
@Component
public class Handles {

    private static UserRepository users;

    public Handles(UserRepository users) {
        Handles.users = users;
    }

    /** the handle of the user with this id; the id only if there's no such user */
    public static String of(String userId) {
        if (userId == null || users == null) return userId;
        return users.findById(userId).map(User::getHandle).filter(h -> h != null && !h.isBlank()).orElse(userId);
    }

    /**
     * The owner a reference names: a handle, or for references written before
     * handles were used, the id itself.
     */
    public static String owner(String handleOrId) {
        if (handleOrId == null || handleOrId.isBlank() || users == null) return handleOrId;
        User byHandle = users.findByHandle(handleOrId);
        return byHandle != null ? byHandle.getId() : handleOrId;
    }
}
