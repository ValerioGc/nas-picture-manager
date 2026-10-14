Feature: Image viewer
  Scenario: Opening images, reading details and navigating
    Given I open the application
    When I select two images
    Then the first image is displayed
    When I open the details panel
    Then the image metadata is visible
    When I move to the next image
    Then the second image is displayed

  Scenario: Zoom presets and custom zoom
    Given I open the application
    When I select two images
    And I choose 200 percent zoom
    Then the image is displayed at double size
    When I apply 125 percent zoom
    Then the image is displayed at custom size

  Scenario: Editing controls can be reset
    Given I open the application
    When I select two images
    And I open the edit panel
    Then the edit controls are available
    When I adjust brightness and reset
    Then the original image is still displayed

  Scenario: Theme and language
    Given I open the application
    When I choose the light theme and English
    Then the viewer uses the light theme and English

  Scenario: Keyboard navigation and panel dismissal
    Given I open the application
    When I select two images
    And I navigate and open details with the keyboard
    Then the second image is displayed
    When I press Escape
    Then the side panel is closed

  Scenario: Side panels remain usable in a compact window
    Given I open the application
    When I select two images
    And I use a compact window
    And I open the edit panel
    Then the compact panel is scrollable and can be closed
