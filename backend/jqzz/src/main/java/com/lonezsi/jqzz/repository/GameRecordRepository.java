package com.lonezsi.jqzz.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lonezsi.jqzz.model.GameRecord;

public interface GameRecordRepository extends JpaRepository<GameRecord, Long> {

    /** Every game this person hosted or played, newest first. */
    @Query("SELECT DISTINCT r FROM GameRecord r LEFT JOIN r.players p "
         + "WHERE r.hostId = :userId OR p.userId = :userId ORDER BY r.finishedAt DESC")
    List<GameRecord> findForUser(@Param("userId") String userId);
}
