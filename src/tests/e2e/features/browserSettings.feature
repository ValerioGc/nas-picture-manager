Feature: Browser appearance parameters
  Scenario Outline: Appearance is supplied by the embedding URL
    Given I open the viewer with parameters "<parameters>"
    Then the browser theme is "<theme>" and language is "<language>"
    And desktop settings are absent from the options menu

    Examples:
      | parameters                 | theme | language |
      | ?theme=light&lang=en        | light | en       |
      | ?theme=dark&lang=it         | dark  | it       |
      | ?theme=invalid&lang=invalid | dark  | it       |

  Scenario: Desktop settings stay absent after opening an image
    Given I open the application
    When I open the color fixture
    Then desktop settings are absent from the options menu
