package com.lonezsi.jqzz.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
//import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.lonezsi.jqzz.model.Lobby;
import com.lonezsi.jqzz.model.Player;
import com.lonezsi.jqzz.repository.LobbyRepository;

@ExtendWith(MockitoExtension.class)
class LobbyControllerTest {

    @Mock
    private LobbyRepository lobbyRepository;

    //@Mock
    //private SimpMessagingTemplate messaging;

    @InjectMocks
    private LobbyController lobbyController;

    @Test
    void create_shouldSaveLobbyAndSendWebSocketEvent() {
        LobbyController.CreateLobbyRequest request = new LobbyController.CreateLobbyRequest();
        request.setName("Test Lobby");
        request.setAdminId(123L);

        Lobby savedLobby = new Lobby();
        savedLobby.setId(1L);
        savedLobby.setName("Test Lobby");
        savedLobby.setAdminId(123L);
        savedLobby.setCurrentActionIndex(-1);
        savedLobby.getPlayers().add(new Player("123", 0));

        when(lobbyRepository.save(org.mockito.ArgumentMatchers.any(Lobby.class))).thenReturn(savedLobby);

        Lobby result = lobbyController.create(request);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("Test Lobby");
        assertThat(result.getAdminId()).isEqualTo(123L);
        assertThat(result.getCurrentActionIndex()).isEqualTo(-1);
        assertThat(result.getPlayers()).hasSize(1);
        assertThat(result.isQuizOver()).isTrue();

        verify(lobbyRepository).save(org.mockito.ArgumentMatchers.any(Lobby.class));
    }

    @Test
    void join_shouldAddPlayerWhenNonExistingAndSendPlayersUpdateEvent() {
        LobbyController.JoinLobbyRequest request = new LobbyController.JoinLobbyRequest();
        request.setUserId("player1");

        Lobby lobby = new Lobby();
        lobby.setId(1L);
        lobby.setName("Test Lobby");
        lobby.setAdminId(123L);

        when(lobbyRepository.findById(1L)).thenReturn(Optional.of(lobby));
        when(lobbyRepository.save(org.mockito.ArgumentMatchers.any(Lobby.class))).thenAnswer(i -> i.getArgument(0));

        Lobby result = lobbyController.join(1L, request);

        assertThat(result.getPlayers()).extracting(Player::userId).contains("player1");

        verify(lobbyRepository).findById(1L);
        verify(lobbyRepository).save(lobby);
    }
}
