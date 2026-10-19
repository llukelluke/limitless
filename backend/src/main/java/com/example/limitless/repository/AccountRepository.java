package com.example.limitless.repository;

import com.example.limitless.entity.Account;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRepository extends JpaRepository<Account, Integer> {

    List<Account> findAllByOrderByNumberAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);

    boolean existsByNumber(Integer number);

    boolean existsByNumberAndIdNot(Integer number, Integer id);
}
