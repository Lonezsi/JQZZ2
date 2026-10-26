package com.lonezsi.jqzz.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.repository.QuizRepository;

/**
 * The editor sends the whole quiz on every save, with ids it generated itself
 * for anything new. Those ids mean nothing to the database, so a save replaces
 * the quiz content with fresh rows instead of trying to merge by id. Incoming
 * question ids are only used to keep a question shared between the actions
 * that reference it.
 */
@Service
public class QuizService {

    private final QuizRepository quizRepository;

    public QuizService(QuizRepository quizRepository) {
        this.quizRepository = quizRepository;
    }

    @Transactional(readOnly = true)
    public List<Quiz> findAll() {
        return quizRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Quiz> findById(Long id) {
        return quizRepository.findById(id);
    }

    @Transactional
    public Quiz create(Quiz incoming) {
        Quiz quiz = new Quiz();
        quiz.setName(incoming.getName());
        quiz.setAuthorId(incoming.getAuthorId());
        quiz = quizRepository.save(quiz);
        replaceContent(quiz, incoming.getActions());
        return quizRepository.saveAndFlush(quiz);
    }

    @Transactional
    public Optional<Quiz> update(Long id, Quiz incoming) {
        return quizRepository.findById(id).map(quiz -> {
            if (incoming.getName() != null) quiz.setName(incoming.getName());
            if (incoming.getAuthorId() != null) quiz.setAuthorId(incoming.getAuthorId());

            // delete the old rows before inserting new ones: actions first,
            // because they reference questions
            quiz.getActions().clear();
            quizRepository.flush();
            quiz.getQuestions().clear();
            quizRepository.flush();

            replaceContent(quiz, incoming.getActions());
            return quizRepository.saveAndFlush(quiz);
        });
    }

    @Transactional
    public boolean delete(Long id) {
        if (!quizRepository.existsById(id)) return false;
        quizRepository.deleteById(id);
        return true;
    }

    private void replaceContent(Quiz quiz, List<Action> incomingActions) {
        if (incomingActions == null) return;

        Map<Long, Question> questionsByIncomingId = new HashMap<>();
        int index = 0;
        for (Action in : incomingActions) {
            if (in == null) continue;

            Action action = new Action();
            action.setQuiz(quiz);
            action.setPhase(in.getPhase() != null ? in.getPhase() : Phase.TEXT);
            action.setTime(in.getTime());
            action.setPreview(in.getPreview());
            action.setOrderIndex(index++);

            Question source = in.getQuestion();
            if (source != null && action.getPhase().isPlayable()) {
                Question question = source.getId() != null
                        ? questionsByIncomingId.get(source.getId())
                        : null;
                if (question == null) {
                    question = copyQuestion(source, quiz);
                    quiz.getQuestions().add(question);
                    if (source.getId() != null) questionsByIncomingId.put(source.getId(), question);
                }
                action.setQuestion(question);
            }

            quiz.getActions().add(action);
        }
    }

    private static Question copyQuestion(Question source, Quiz quiz) {
        Question question = new Question();
        question.setQuiz(quiz);
        question.setText(source.getText());
        question.setImageUrl(source.getImageUrl());
        question.setElaborationText(source.getElaborationText());
        question.setElaborationImageUrl(source.getElaborationImageUrl());
        question.setType(source.getType());
        question.setUserId(source.getUserId());

        List<Answer> answers = new ArrayList<>();
        if (source.getAnswers() != null) {
            for (Answer a : source.getAnswers()) {
                if (a == null) continue;
                Answer answer = new Answer();
                answer.setQuestion(question);
                answer.setText(a.getText());
                answer.setValue(a.getValue());
                answer.setImageUrl(a.getImageUrl());
                answer.setUserId(a.getUserId());
                answers.add(answer);
            }
        }
        question.setAnswers(answers);
        return question;
    }
}
