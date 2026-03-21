package com.lonezsi.jqzz.init;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;

@Component
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;

    public DataLoader(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.count() == 0) {
            User user = new User();
            user.setId("guest");
            user.setName("Guest");
            user.setHandle("guest");
            user.setOnline(true);
            userRepository.save(user);
            System.out.println("Guest user created with ID: guest");
        }
    }
}