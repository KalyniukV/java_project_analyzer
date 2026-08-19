package com.example.gwtapp.client.service;

import com.example.gwtapp.shared.model.GreetingRequest;
import com.example.gwtapp.shared.model.GreetingResponse;

@RemoteServiceRelativePath("greet")
public interface GreetingService {
    GreetingResponse greetServer(GreetingRequest request) throws IllegalArgumentException;
}
