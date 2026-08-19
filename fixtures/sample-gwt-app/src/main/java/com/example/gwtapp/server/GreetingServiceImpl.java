package com.example.gwtapp.server;

import com.example.gwtapp.client.service.GreetingService;
import com.example.gwtapp.server.repository.GreetingLogRepository;
import com.example.gwtapp.server.service.MessageFormatterService;
import com.example.gwtapp.shared.model.GreetingRequest;
import com.example.gwtapp.shared.model.GreetingResponse;

public class GreetingServiceImpl extends RemoteServiceServlet implements GreetingService {
    private final MessageFormatterService formatterService = new MessageFormatterService();
    private final GreetingLogRepository logRepository = new GreetingLogRepository();

    public GreetingResponse greetServer(GreetingRequest request) throws IllegalArgumentException {
        if (request == null || request.getName() == null) {
            throw new IllegalArgumentException("Name cannot be null");
        }

        String formatted = formatterService.formatGreeting(request.getName());
        logRepository.saveLog(request.getName(), formatted);

        return new GreetingResponse(formatted, "GWT Server", System.currentTimeMillis());
    }
}
