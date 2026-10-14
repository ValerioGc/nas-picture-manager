Feature: Image backend
  Scenario: A damaged image produces a readable error
    Given I open the application
    When I open a damaged image
    Then an image error is reported
