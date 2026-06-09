package edu.uclm.qute;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

@SpringBootApplication
public class QuteApplication extends SpringBootServletInitializer {

    public static void main(String[] args) {
        SpringApplication.run(QuteApplication.class, args);
    }
}
