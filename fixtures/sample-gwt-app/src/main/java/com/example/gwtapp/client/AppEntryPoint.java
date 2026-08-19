package com.example.gwtapp.client;

import com.example.gwtapp.client.presenter.GreetingPresenter;
import com.example.gwtapp.client.view.GreetingView;

public class AppEntryPoint {
    private GreetingPresenter presenter;

    public void onModuleLoad() {
        GreetingView view = new GreetingView();
        presenter = new GreetingPresenter(view);
    }
}
