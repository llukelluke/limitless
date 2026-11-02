package com.example.limitless.config;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter)
            throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 1. Public
                        .requestMatchers("/error",
                                "/api/auth/login",
                                "/api/auth/forgot-password",
                                "/api/auth/reset-password",
                                "/api/auth/access-requests").permitAll()

                        // 2. Anyone logged in can view accounts, ledgers, event logs, journal entries
                        .requestMatchers(HttpMethod.GET,
                                "/api/accounts/**", "/api/event-log/**", "/api/journal-entries/**")
                        .hasAnyRole("ADMINISTRATOR", "MANAGER", "ACCOUNTANT")

                        // 3. Email from the account pages: all roles
                        .requestMatchers("/api/email/**")
                        .hasAnyRole("ADMINISTRATOR", "MANAGER", "ACCOUNTANT")

                        // 4. Only a manager approves or rejects
                        .requestMatchers(HttpMethod.PUT,
                                "/api/journal-entries/*/approve", "/api/journal-entries/*/reject")
                        .hasRole("MANAGER")

                        // 5. Create, edit, cancel, submit, attach: manager or accountant
                        .requestMatchers("/api/journal-entries/**")
                        .hasAnyRole("MANAGER", "ACCOUNTANT")

                        // 6. Add, edit, deactivate accounts: administrator only
                        .requestMatchers("/api/accounts/**").hasRole("ADMINISTRATOR")

                        // 7. Admin-only user management (your existing rules)
                        .requestMatchers("/api/auth/access-requests/**", "/api/users/**").hasRole("ADMINISTRATOR")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());

        return http.build();
    }

    // Browsers block calls from the React app's origin unless the API allows it.
    // Set CORS_ALLOWED_ORIGINS to the deployed frontend URL (comma-separated for several).
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${cors.allowed-origins:http://localhost:3000}") String origins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(origins.split(",")));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}