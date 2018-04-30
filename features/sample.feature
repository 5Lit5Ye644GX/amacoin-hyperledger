#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

Feature: Sample

    Background:
        Given I have deployed the business network definition ..
        And I have added the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 10     |
            | 2  | 20     |
        And I have added the following participants of type com.amaris.coin.Customer
            | id              | firstName | lastName | account |
            | alice@email.com | Alice     | Wonder   | 1       |
            | bob@email.com   | Bob       | Dilan    | 2       |
        And I have added the following participants of type com.amaris.coin.Banker
            | id                | firstName | lastName |
            | charlie@email.com | Charlie   | Chaplin  |
        And I have issued the participant com.amaris.coin.Customer#alice@email.com with the identity alice1
        And I have issued the participant com.amaris.coin.Customer#bob@email.com with the identity bob1
        And I have issued the participant com.amaris.coin.Banker#charlie@email.com with the identity charlie1

    Scenario: Alice can read her account
        When I use the identity alice1
        Then I should have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 10     |
            | 2  | 20     |

    Scenario: Bob can read his account
        When I use the identity bob1
        Then I should have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  |  10    |
            | 2  |  20    |

    Scenario: Alice cannot create a new account
        When I use the identity alice1
        And I add the following asset of type com.amaris.coin.Account
            | id | amount |
            | 3  | 30     |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Bob cannot create a new account
        When I use the identity bob1
        And I add the following asset of type com.amaris.coin.Account
            | id | amount |
            | 3  | 40     |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Charlie can create an account for a new customer
        When I use the identity charlie1
        And I add the following asset of type com.amaris.coin.Account
            | id | amount |
            | 3  | 50     |
        And I have added the following participants of type com.amaris.coin.Customer
            | id            | firstName | lastName | account |
            | dan@email.com | Dan       | Kreig    | 3       |
        Then I should have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 50     | 

    Scenario: Charlie can issue an account
        When I use the identity charlie1
        And I submit the following transaction of type com.amaris.coin.Issue
            | account | amount |
            | 1       | 50     |
        Then I should have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 60     |
        And I should have received the following event of type com.amaris.coin.Issued
            | account | previousValue | newValue |
            | 1       | 10            | 60       |

    Scenario: Charlie can remove an account
        When I use the identity charlie1
        And I remove the following asset of type com.amaris.coin.Account
            | id |
            | 1  |
        Then I should not have the following assets of type com.amaris.coin.Account
            | id |
            | 1  |

    Scenario: Alice cannot issue her account
        When I use the identity alice1
        And I submit the following transaction of type com.amaris.coin.Issue
            | account | amount |
            | 1       | 50     |
        Then I should not have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 60     |

    Scenario: Alice cannot update her assets
        When I use the identity alice1
        And I update the following asset of type com.amaris.coin.Account
            | id | amount |
            | 1  | 50     |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Alice cannot update Bob's account
        When I use the identity alice1
        And I update the following asset of type com.amaris.coin.Account
            | id | amount |
            | 2  | 50     |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Bob cannot issue his account
        When I use the identity bob1
        And I submit the following transaction of type com.amaris.coin.Issue
            | account | amount |
            | 1       | 20     |
        Then I should not have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 40     |

    Scenario: Bob cannot update his account
        When I use the identity bob1
        And I update the following asset of type com.amaris.coin.Account
            | id | amount |
            | 2  | 60     |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Bob cannot update Alice's account
        When I use the identity bob1
        And I update the following asset of type com.amaris.coin.Account
            | id | amount |
            | 1  | 60     |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Alice can remove her account
        When I use the identity alice1
        And I remove the following asset of type com.amaris.coin.Account
            | id |
            | 1  |
        Then I should not have the following assets of type com.amaris.coin.Account
            | id |
            | 1  |

    Scenario: Alice cannot remove Bob's account
        When I use the identity alice1
        And I remove the following asset of type com.amaris.coin.Account
            | id |
            | 2  |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Bob can remove his account
        When I use the identity bob1
        And I remove the following asset of type com.amaris.coin.Account
            | id |
            | 2  |
        Then I should not have the following assets of type com.amaris.coin.Account
            | id |
            | 2  |

    Scenario: Bob cannot remove Alice's account
        When I use the identity bob1
        And I remove the following asset of type com.amaris.coin.Account
            | id |
            | 1  |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Alice can submit a transaction from her account to Bob's account
        When I use the identity alice1
        And I submit the following transaction of type com.amaris.coin.Transfer
            | from | to | amount |
            | 1    | 2  | 5      |
        Then I should have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 5      |
            | 2  | 25     |
        And I should have received the following event of type com.amaris.coin.Transfered
            | from | to | amount |
            | 1    | 2  | 5      |

    Scenario: Alice cannot submit a transaction for Bob's account
        When I use the identity alice1
        And I submit the following transaction of type com.amaris.coin.Transfer
            | from | to | amount |
            | 2    | 1  | 5      |
        Then I should get an error matching /does not have .* access to resource/

    Scenario: Alice cannot submit without sufficient funds
        When I use the identity alice1
        And I submit the following transaction of type com.amaris.coin.Transfer
            | from | to | amount |
            | 1    | 2  | 10.5   |
        Then I should get an error matching /Insufficient funds!/

    Scenario: Bob can submit a transaction from his account to Alice's account
        When I use the identity bob1
        And I submit the following transaction of type com.amaris.coin.Transfer
            | from | to | amount |
            | 2    | 1  | 10     |
        Then I should have the following assets of type com.amaris.coin.Account
            | id | amount |
            | 1  | 20     |
            | 2  | 10     |
        And I should have received the following event of type com.amaris.coin.Transfered
            | from | to | amount |
            | 2    | 1  | 10     |

    Scenario: Bob cannot submit a transaction from Alice's account
        When I use the identity bob1
        And I submit the following transaction of type com.amaris.coin.Transfer
            | from | to | amount |
            | 1    | 2  | 5      |
        Then I should get an error matching /does not have .* access to resource/
