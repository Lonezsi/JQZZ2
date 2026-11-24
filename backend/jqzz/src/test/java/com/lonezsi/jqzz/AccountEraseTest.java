package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.lonezsi.jqzz.model.Drawing;
import com.lonezsi.jqzz.model.Friendship;
import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Notification;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.StashItem;
import com.lonezsi.jqzz.model.StashKind;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.DrawingRepository;
import com.lonezsi.jqzz.repository.FriendshipRepository;
import com.lonezsi.jqzz.repository.ImageRepository;
import com.lonezsi.jqzz.repository.NotificationRepository;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.StashItemRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.AccountEraser;

/** Deleting an account takes what is theirs with it, and nothing of anyone else's. */
@SpringBootTest
class AccountEraseTest {

    @Autowired AccountEraser eraser;
    @Autowired UserRepository users;
    @Autowired QuizRepository quizzes;
    @Autowired ImageRepository images;
    @Autowired StashItemRepository stash;
    @Autowired FriendshipRepository friendships;
    @Autowired NotificationRepository notifications;
    @Autowired DrawingRepository drawings;

    private User user(String id) {
        User u = new User();
        u.setId(id);
        u.setHandle(id);
        u.setName(id);
        return users.save(u);
    }

    private StashItem stashed(String by, Long imageId) {
        StashItem s = new StashItem();
        s.setKind(StashKind.IMAGE);
        s.setHandle("h" + System.nanoTime());
        s.setVisibility(ImageVisibility.PRIVATE);
        s.setSavedBy(by);
        s.setImageId(imageId);
        return stash.save(s);
    }

    @Test
    void whatIsTheirsGoesAndWhatIsNotStays() {
        String n = String.valueOf(System.nanoTime());
        String a = "a" + n, b = "b" + n;
        user(a);
        user(b);

        Quiz qa = new Quiz(); qa.setName("mine"); qa.setAuthorId(a); qa = quizzes.save(qa);
        Quiz qb = new Quiz(); qb.setName("theirs"); qb.setAuthorId(b); qb = quizzes.save(qb);

        Image pub = new Image("pub" + n, null, ImageVisibility.PUBLIC, Pic.png(1), "image/png");
        pub.setUploadedBy(a);
        pub = images.save(pub);
        Image priv = new Image("priv" + n, a, ImageVisibility.PRIVATE, Pic.png(2), "image/png");
        priv.setUploadedBy(a);
        priv = images.save(priv);

        StashItem mine = stashed(a, priv.getId());
        StashItem bsOfPublic = stashed(b, pub.getId());
        StashItem bsOwn = stashed(b, null);

        Friendship f = friendships.save(new Friendship(a, b, a));
        Notification toB = notifications.save(new Notification(b, Notification.FRIEND_REQUEST, a, null));
        Notification toA = notifications.save(new Notification(a, Notification.FRIEND_REQUEST, b, null));

        Drawing da = drawings.save(new Drawing(1L, "ka" + n, "image/png", Pic.png(3), a));
        Drawing db = drawings.save(new Drawing(1L, "kb" + n, "image/png", Pic.png(4), b));

        eraser.erase(a);

        assertThat(users.existsById(a)).isFalse();
        assertThat(quizzes.existsById(qa.getId())).isFalse();
        assertThat(images.existsById(pub.getId())).isFalse();
        assertThat(images.existsById(priv.getId())).isFalse();
        assertThat(stash.existsById(mine.getId())).isFalse();
        assertThat(stash.existsById(bsOfPublic.getId())).isFalse();
        assertThat(friendships.existsById(f.getId())).isFalse();
        assertThat(notifications.existsById(toB.getId())).isFalse();
        assertThat(notifications.existsById(toA.getId())).isFalse();
        assertThat(drawings.existsById(da.getId())).isFalse();

        assertThat(users.existsById(b)).isTrue();
        assertThat(quizzes.existsById(qb.getId())).isTrue();
        assertThat(stash.existsById(bsOwn.getId())).isTrue();
        assertThat(drawings.existsById(db.getId())).isTrue();
    }
}
