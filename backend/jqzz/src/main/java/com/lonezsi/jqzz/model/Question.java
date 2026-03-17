package com.lonezsi.jqzz.model;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;

@Entity
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name="quiz_id")
    @JsonIgnore
    private Quiz quiz;

    private String text;

    private String imageUrl;

    private String elaborationText;

    private String elaborationImageUrl;

    private QuestionType type;

    private String userId; // for user generated content, store the author's userId

    @OneToMany(mappedBy="question", cascade = CascadeType.ALL)
    private List<Answer> answers;

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public Quiz getQuiz(){return quiz;}
    public void setQuiz(Quiz quiz){this.quiz=quiz;}

    public List<Answer> getAnswers(){return answers;}
    public void setAnswers(List<Answer> answers){this.answers=answers;}

    public String getUserId(){return userId;}
    public void setUserId(String userId){this.userId=userId;}

    // data
    public String getText(){return text;}
    public void setText(String text){this.text=text;}

    public String getImageUrl(){return imageUrl;}
    public void setImageUrl(String imageUrl){this.imageUrl=imageUrl;}

    public String getElaborationText(){return elaborationText;}
    public void setElaborationText(String elaborationText){this.elaborationText=elaborationText;}
    
    public String getElaborationImageUrl(){return elaborationImageUrl;}
    public void setElaborationImageUrl(String elaborationImageUrl){this.elaborationImageUrl=elaborationImageUrl;}

    public QuestionType getType(){return type;}
    public void setType(QuestionType type){this.type=type;}

    // --- Logic to compute results based on type ---
    
    public int evaluateSingleChoice(int selectedAnswerId){
        if(type != QuestionType.PREWRITTEN_SINGLE) throw new IllegalStateException("Wrong question type");
        return answers.stream()
                .filter(a -> a.getId().intValue() == selectedAnswerId)
                .mapToInt(Answer::getValue)
                .findFirst()
                .orElse(0);
    }

    public int evaluateMultipleChoice(List<Integer> selectedAnswerIds){
        if(type != QuestionType.PREWRITTEN_MULTIPLE) throw new IllegalStateException("Wrong question type");
        return answers.stream()
                .filter(a -> selectedAnswerIds.contains(a.getId().intValue()))
                .mapToInt(Answer::getValue)
                .sum();
    }

    public List<Answer> evaluateTierlist(){
        if(type != QuestionType.TIERLIST) throw new IllegalStateException("Wrong question type");
        // In tierlist, the Answer.value stores the position
        answers.sort((a,b) -> Integer.compare(a.getValue(), b.getValue()));
        return answers;
    }

    public Answer evaluateKnockoutBattle(int firstAnswerId, int secondAnswerId){
        if(type != QuestionType.KNOCKOUT_BATTLE) throw new IllegalStateException("Wrong question type");
        Answer first = answers.stream().filter(a -> a.getId().intValue()==firstAnswerId).findFirst().orElse(null);
        Answer second = answers.stream().filter(a -> a.getId().intValue()==secondAnswerId).findFirst().orElse(null);
        if(first == null || second == null) return null;
        // Winner = higher value
        return first.getValue() >= second.getValue() ? first : second;
    }

    public void assignUserAnswer(int answerId, int value){
        // Generic for user generated answers (text/image)
        Answer ans = answers.stream().filter(a -> a.getId().intValue()==answerId).findFirst().orElse(null);
        if(ans != null){
            ans.setValue(value);
        }
    }

    // --- USER GENERATED VOTE ---
    public Answer evaluateVote(){
        if(type != QuestionType.USER_GENERATED_VOTE) throw new IllegalStateException("Wrong question type");
        // Each answer's value represents number of votes
        return answers.stream()
                .max(Comparator.comparingInt(Answer::getValue))
                .orElse(null);
    }

    // --- USER GENERATED IDENTIFY ---
    public Map<Answer, Answer> evaluateIdentify(Map<Integer, Long> guessMap){
        /*
         * guessMap: key = answerId being guessed, value = userId guessed as author
         * returns: Map<Answer, Answer> where key = answer, value = userAnswer guessed as correct author
         */
        if(type != QuestionType.USER_GENERATED_IDENTIFY) throw new IllegalStateException("Wrong question type");

        Map<Answer, Answer> results = new HashMap<>();
        for(Answer ans : answers){
            Long guessedUserId = guessMap.get(ans.getId().intValue());
            if(guessedUserId != null){
                // find the correct answer submitted by that user
                Answer correctAnswer = answers.stream()
                        .filter(a -> a.getUserId().equals(guessedUserId.toString()))
                        .findFirst()
                        .orElse(null);
                results.put(ans, correctAnswer);
            } else {
                results.put(ans, null);
            }
        }
        return results;
    }
}