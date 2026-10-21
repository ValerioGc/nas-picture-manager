Feature: Open images from the NAS
  Scenario: Open a NAS image with the keyboard and cancel a replacement
    Given I open the viewer inside the NAS shell
    When I request a NAS image with the open shortcut
    Then the image comes from the NAS with image filters and no local file chooser
    When I cancel the next NAS selection
    Then the NAS image stays open without an error

  Scenario: Report an unavailable Explorer without replacing the image
    Given I open the viewer inside the NAS shell
    When I open an image in the NAS frame
    And Explorer is unavailable for the next selection
    Then an Explorer error is shown and the NAS image stays open
