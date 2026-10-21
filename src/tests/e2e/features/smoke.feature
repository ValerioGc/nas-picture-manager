Feature: Application shell
  Scenario: A browser home screen without desktop controls
    Given I open the application
    Then the page has a title
    And the home screen is minimal and fits the window
