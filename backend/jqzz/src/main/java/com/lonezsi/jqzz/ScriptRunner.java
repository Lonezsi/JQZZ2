package com.lonezsi.jqzz;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionTypes;


public class ScriptRunner {

    private final Map<String, Question> questions = new HashMap<>();
    private final List<Command> commands = new ArrayList<>();
    private int currentIndex = 0;

    public void parseScript(String script) throws Exception {
        String[] lines = script.split("\n");
        Pattern questionPattern = Pattern.compile("Question\\s+(\\w+)\\s*\\{");
        Pattern commandPattern = Pattern.compile("(Ask|Elaborate|Results)\\((\\w+)(?:,\\s*(\\d+))?\\)");

        Question current = null;
        String currentQId = null;
        StringBuilder block = new StringBuilder();

        for(String line : lines){
            line = line.trim();
            if(line.isEmpty() || line.startsWith("//")) continue;

            Matcher qMatch = questionPattern.matcher(line);
            if(qMatch.find()){
                current = new Question();
                current.setType(QuestionTypes.PREWRITTEN_SINGLE); // default type
                block.setLength(0);
                currentQId = qMatch.group(1);
                continue;
            }

            if(current != null){
                if(line.equals("}")) {
                    parseQuestionBlock(current, block.toString());
                    questions.put(currentQId, current);
                    current = null;
                    currentQId = null;
                } else {
                    block.append(line).append("\n");
                }
                continue;
            }

            Matcher cMatch = commandPattern.matcher(line);
            if(cMatch.find()){
                String cmd = cMatch.group(1);
                String qId = cMatch.group(2);
                String timeStr = cMatch.group(3);
                int time = timeStr != null ? Integer.parseInt(timeStr) : 0; // default 0

                switch(cmd){
                    case "Ask" -> commands.add(new AskCommand(qId, time));
                    case "Elaborate" -> commands.add(new ElaborateCommand(qId, time));
                    case "Results" -> commands.add(new ResultsCommand(qId, time));
                }
            }
        }
    }

    private void parseQuestionBlock(Question q, String blockStr){
        blockStr = blockStr.replaceAll(",\\s*\n?", "\n"); // split commas or newlines
        for(String line : blockStr.split("\n")){
            line = line.trim();
            if(line.isEmpty()) continue;

            if(line.startsWith("type:")) {
                String typeStr = line.substring(5).trim();
                q.setType(QuestionTypes.valueOf(typeStr));
            } else if(line.startsWith("text:")) {
                q.setText(line.substring(5).trim().replaceAll("\"",""));
            } else if(line.startsWith("image:")) {
                String raw = line.substring(6).trim().replaceAll("\"","");
                q.setImageUrl(resolveImage(raw));
            } else if(line.startsWith("elaboration-text:")) {
                q.setElaborationText(line.substring(17).trim().replaceAll("\"",""));
            } else if(line.startsWith("elaboration-image:")) {
                String raw = line.substring(18).trim().replaceAll("\"","");
                q.setElaborationImageUrl(resolveImage(raw));
            }
        }
    }

    /**
     * Detects the type of image input and normalizes it:
     * - public ID: only letters/numbers, no symbols → store as-is
     * - private ID: MyUser:someid → store as-is
     * - URL: anything with "://" → store as-is
     */
    private String resolveImage(String input){
        if(input.isEmpty()) return null;
        if(input.contains("://")) return input; // URL
        if(input.contains(":")) return input;   // private id
        return input;                           // public id
    }

    public boolean hasNext(){ return currentIndex < commands.size(); }

    public ScriptEvent nextEvent(){
        if(!hasNext()) return null;
        Command cmd = commands.get(currentIndex++);
        return cmd.toEvent(questions);
    }

    public interface ScriptEvent {
        default String getEventType() {
            return "script_event";
        }
        Map<String,Object> getPayload();
    }

    public interface Command {
        ScriptEvent toEvent(Map<String, Question> questions);
    }

    // Reactive commands
    public static class AskCommand implements Command {
        String qId; int time;
        public AskCommand(String qId, int time){ this.qId=qId; this.time=time; }
        @Override
        public ScriptEvent toEvent(Map<String, Question> questions){
            Question q = questions.get(qId);
            return () -> {
                Map<String,Object> payload = new HashMap<>();
                payload.put("questionId", qId);
                payload.put("question", q);
                payload.put("time", time);
                return payload;
            };
        }
    }

    public static class ElaborateCommand implements Command {
        String qId; int time;
        public ElaborateCommand(String qId, int time){ this.qId=qId; this.time=time; }
        @Override
        public ScriptEvent toEvent(Map<String, Question> questions){
            Question q = questions.get(qId);
            return () -> {
                Map<String,Object> payload = new HashMap<>();
                payload.put("questionId", qId);
                payload.put("text", q.getElaborationText());
                payload.put("image", q.getElaborationImageUrl());
                payload.put("time", time);
                return payload;
            };
        }
    }

    public static class ResultsCommand implements Command {
        String qId; int time;
        public ResultsCommand(String qId, int time){ this.qId=qId; this.time=time; }
        @Override
        public ScriptEvent toEvent(Map<String, Question> questions){
            Question q = questions.get(qId);
            return () -> {
                Map<String,Object> payload = new HashMap<>();
                payload.put("questionId", qId);
                payload.put("results", evaluateQuestionResults(q));
                payload.put("time", time);
                return payload;
            };
        }

        private Map<String,Object> evaluateQuestionResults(Question q){
            Map<String,Object> res = new HashMap<>();
            switch(q.getType()){
                case PREWRITTEN_SINGLE, PREWRITTEN_MULTIPLE -> res.put("answers", q.getAnswers());
                case TIERLIST                               -> res.put("answers", q.evaluateTierlist());
                case KNOCKOUT_BATTLE                        -> res.put("answers", q.getAnswers());
                case USER_GENERATED_VOTE                    -> res.put("winner", q.evaluateVote());
                case USER_GENERATED_IDENTIFY                -> res.put("answers", q.getAnswers());
                case USER_GENERATED                         -> res.put("answers", q.getAnswers());
            }
            return res;
        }
    }
}