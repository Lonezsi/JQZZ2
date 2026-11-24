package com.lonezsi.jqzz.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.repository.DrawingRepository;
import com.lonezsi.jqzz.repository.FriendshipRepository;
import com.lonezsi.jqzz.repository.ImageRepository;
import com.lonezsi.jqzz.repository.NotificationRepository;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.StashItemRepository;
import com.lonezsi.jqzz.repository.UserRepository;

/**
 * Deleting an account: everything that is this person's goes with it, public
 * items too (GDPR Art. 17). Games they played stay in the other players' history
 * under the name they had; drawings kept before they were tagged with a drawer stay.
 */
@Service
public class AccountEraser {

    private final UserRepository users;
    private final LoginKeys keys;
    private final QuizRepository quizzes;
    private final ImageRepository images;
    private final StashItemRepository stash;
    private final FriendshipRepository friendships;
    private final NotificationRepository notifications;
    private final DrawingRepository drawings;

    public AccountEraser(UserRepository users, LoginKeys keys, QuizRepository quizzes, ImageRepository images,
            StashItemRepository stash, FriendshipRepository friendships, NotificationRepository notifications,
            DrawingRepository drawings) {
        this.users = users;
        this.keys = keys;
        this.quizzes = quizzes;
        this.images = images;
        this.stash = stash;
        this.friendships = friendships;
        this.notifications = notifications;
        this.drawings = drawings;
    }

    @Transactional
    public void erase(String userId) {
        List<Image> mine = images.findMine(userId);
        List<Long> pictureIds = mine.stream().map(Image::getId).toList();
        stash.deleteAll(stash.findBySavedBy(userId));
        // other people's stash entries must not point at pictures that are gone
        if (!pictureIds.isEmpty()) stash.deleteAll(stash.findByImageIdIn(pictureIds));
        images.deleteAll(mine);
        quizzes.deleteAll(quizzes.findByAuthorId(userId));
        friendships.deleteAll(friendships.involving(userId));
        notifications.deleteAll(notifications.involving(userId));
        drawings.deleteAll(drawings.findByDrawnBy(userId));
        users.deleteById(userId);
        keys.forget(userId);
    }
}
