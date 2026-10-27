package com.lonezsi.jqzz.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lonezsi.jqzz.model.Friendship;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    @Query("SELECT f FROM Friendship f WHERE f.userA = :userId OR f.userB = :userId")
    List<Friendship> involving(@Param("userId") String userId);

    Optional<Friendship> findByUserAAndUserB(String userA, String userB);

    default Optional<Friendship> between(String one, String other) {
        return one.compareTo(other) < 0 ? findByUserAAndUserB(one, other) : findByUserAAndUserB(other, one);
    }
}
