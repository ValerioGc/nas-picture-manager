Feature: Editing and exporting images
  Scenario: Rotate and export a PNG copy
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I rotate the image clockwise
    Then the preview has dimensions 48 by 64
    And the rotated pixels match the original
    When I save and reopen a PNG copy
    Then the preview has dimensions 48 by 64
    And the source fixture is unchanged

  Scenario: Horizontal and vertical flips change the pixels
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I flip the image horizontally
    Then the left edge contains the original right edge
    When I reset all edits
    And I flip the image vertically
    Then the top edge contains the original bottom edge

  Scenario: Adjustments and reset use the original pixels
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I set brightness to 20
    Then the preview is brighter
    When I reset all edits
    Then the original pixels are restored
    When I set contrast to 50
    Then the preview contrast changes
    When I reset all edits
    And I set sharpness to 100
    Then the preview sharpness changes

  Scenario: Crop with numeric bounds and export WebP
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I crop to a 20 by 10 rectangle at 5 and 6
    Then the preview has dimensions 20 by 10
    When I save and reopen a WebP copy
    Then the preview has dimensions 20 by 10

  Scenario: Crop ratio and pointer selection
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I choose a square crop
    Then the crop fields describe a square
    When I cancel the crop
    Then the original pixels are restored
    When I draw a crop rectangle
    Then the preview has dimensions 32 by 24

  Scenario: Invalid crop is not applied
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I enter an invalid crop
    Then applying the crop is disabled

  Scenario: JPEG export uses the selected format
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I save and reopen a JPEG copy
    Then the preview has dimensions 64 by 48
    And the source fixture is unchanged

  Scenario: Unsaved changes can be kept or discarded
    Given I open the application
    When I select two images
    And I open the edit panel
    And I rotate the image clockwise
    And I cancel navigation with unsaved changes
    Then the first image is displayed
    When I confirm navigation with unsaved changes
    Then the second image is displayed

  Scenario Outline: Leaving the edit panel asks for confirmation
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I set brightness to 20
    And I request leaving edits using "<action>"
    Then the edit exit confirmation is visible
    When I cancel leaving the edit panel
    Then the brightness adjustment remains 20
    When I request leaving edits using "<action>"
    And I confirm leaving the edit panel
    Then the active side panel is "<panel>"
    And the original pixels are restored
    When I open the edit panel
    And I open the adjustment tool
    Then the brightness adjustment remains 0

    Examples:
      | action      | panel  |
      | panel_close | closed |
      | edit_toggle | closed |
      | info_toggle | info   |
      | Escape      | closed |
      | e           | closed |
      | i           | info   |

  Scenario: Browser reload can be cancelled without losing edits
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I rotate the image clockwise
    And I cancel reloading with unsaved changes
    Then the preview has dimensions 48 by 64
    And the reload keeps unsaved edits

  Scenario: Failed export can be retried without losing edits
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    And I rotate the image clockwise
    And the next export fails
    Then the export error is visible
    When I save and reopen a PNG copy
    Then the preview has dimensions 48 by 64

  Scenario: Empty viewer blocks editing
    Given I open the application
    Then editing is disabled without an image

  Scenario Outline: Export defaults to the source format and remains selectable
    Given I open the application
    When I open the color fixture
    And I reopen the fixture encoded as <source>
    And I open the edit panel
    Then the selected export format is <default>
    When I save and reopen a copy in the default format
    Then the selected export format is <default>
    When I save and reopen a WebP copy
    Then the selected export format is webp

    Examples:
      | source | default |
      | PNG    | png     |
      | JPEG   | jpeg    |
      | WebP   | webp    |
      | GIF    | original |
      | BMP    | original |
      | TIFF   | original |
      | ICO    | original |

  Scenario: Adjustment controls open on demand and retain changes when changing tools
    Given I open the application
    When I open the color fixture
    And I open the edit panel
    Then adjustment controls are hidden
    When I open the adjustment tool
    And I set brightness to 20
    Then the preview is brighter
    When I rotate the image clockwise
    Then adjustment controls are hidden
    When I open the adjustment tool
    Then the brightness adjustment remains 20

  Scenario Outline: Original export uses source content and retains manual format choices
    Given I open the application
    When I open the color fixture
    And I reopen the fixture encoded as <source>
    And I open the edit panel
    And I save and reopen an Original copy as <output>
    Then the selected export format for <output> matches its source
    When I save and reopen a WebP copy
    Then the selected export format is webp

    Examples:
      | source | output |
      | PNG    | png    |
      | JPEG   | jpeg   |
      | WebP   | webp   |
      | GIF    | gif    |
      | BMP    | bmp    |
      | TIFF   | tiff   |
      | ICO    | ico    |
