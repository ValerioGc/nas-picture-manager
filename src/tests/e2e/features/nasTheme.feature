Feature: Launcher theme context
  Scenario: Apply and update a launcher palette without losing the image
    Given I open the viewer inside the NAS shell
    Then the viewer follows the light launcher palette and English
    When I open an image in the NAS frame
    And the launcher selects a different dark palette and Italian
    Then the viewer follows the dark launcher palette and keeps the image
    When the launcher clears the palette and accent
    Then the viewer uses the local dark palette and keeps the image
