package com.example.limitless.repository;

import com.example.limitless.entity.SavedStatement;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedStatementRepository extends JpaRepository<SavedStatement, Integer> {

    List<SavedStatement> findAllByOrderByGeneratedAtDesc();
}
