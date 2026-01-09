/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <XCTest/XCTest.h>
#import <OCMock/OCMock.h>
#import "../RNPingStorage.h"

@interface RNPingStorage (Testing)
- (id)swiftImpl;
@end

// Protocol for the Swift API so tests can mock without linking Swift symbols.
@protocol RNPingStorageImplProtocol <NSObject>
- (void)save:(NSString *)id
        item:(NSDictionary *)item
    resolver:(RCTPromiseResolveBlock)resolve
    rejecter:(RCTPromiseRejectBlock)reject;
- (void)getItem:(NSString *)id
       resolver:(RCTPromiseResolveBlock)resolve
       rejecter:(RCTPromiseRejectBlock)reject;
- (void)deleteItem:(NSString *)id
          resolver:(RCTPromiseResolveBlock)resolve
          rejecter:(RCTPromiseRejectBlock)reject;
@end

@interface RNPingStorageTests : XCTestCase
@property (nonatomic, strong) RNPingStorage *storage;
@property (nonatomic, strong) id mockSwiftImpl;
@end

@implementation RNPingStorageTests

- (void)setUp {
    [super setUp];
    self.storage = OCMPartialMock([[RNPingStorage alloc] init]);
    
    // Create a mock for the Swift implementation
    self.mockSwiftImpl = OCMStrictProtocolMock(@protocol(RNPingStorageImplProtocol));
    
    // Stub the swiftImpl method to return our mock
    OCMStub([self.storage swiftImpl]).andReturn(self.mockSwiftImpl);
}

- (void)tearDown {
    [self.mockSwiftImpl stopMocking];
    self.mockSwiftImpl = nil;
    [(id)self.storage stopMocking];
    self.storage = nil;
    [super tearDown];
}

// MARK: - Module Initialization Tests

- (void)testModuleInitialization {
    XCTAssertNotNil(self.storage, @"RNPingStorage should initialize successfully");
}

// MARK: - Save Method Tests

- (void)testSaveCallsSwiftImplementation {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *item = @{@"key": @"value", @"number": @42};
    
    // Stub the save method to call the resolver
    OCMStub([self.mockSwiftImpl save:storageId
                                item:item
                            resolver:[OCMArg any]
                            rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTAssertNotNil(result, @"Save should return a result");
                   XCTAssertTrue([result boolValue], @"Save should return true on success");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save should not reject: %@", message);
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    
    OCMVerify([self.mockSwiftImpl save:storageId item:item resolver:[OCMArg any] rejecter:[OCMArg any]]);
}

- (void)testSaveWithEmptyDictionary {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save with empty dictionary should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *item = @{};
    
    OCMStub([self.mockSwiftImpl save:storageId
                                item:item
                            resolver:[OCMArg any]
                            rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTAssertTrue([result boolValue], @"Save should succeed with empty dictionary");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save should not reject with empty dictionary: %@", message);
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

- (void)testSaveWithComplexData {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save with complex data should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *item = @{
        @"string": @"test",
        @"number": @123,
        @"boolean": @YES,
        @"array": @[@1, @2, @3],
        @"nested": @{@"inner": @"value"}
    };
    
    OCMStub([self.mockSwiftImpl save:storageId
                                item:item
                            resolver:[OCMArg any]
                            rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTAssertTrue([result boolValue], @"Save should succeed with complex data");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save should not reject: %@", message);
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

- (void)testSaveRejectsOnError {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save should reject on error"];
    
    NSString *storageId = @"invalid-storage-id";
    NSDictionary *item = @{@"key": @"value"};
    
    NSError *testError = [NSError errorWithDomain:@"TestDomain" code:500 userInfo:nil];
    OCMStub([self.mockSwiftImpl save:storageId
                                item:item
                            resolver:[OCMArg any]
                            rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:5];
            reject(@"E_SAVE_FAILED", @"Failed to save", testError);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTFail(@"Save should not resolve on error");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTAssertEqualObjects(code, @"E_SAVE_FAILED", @"Error code should match");
                    XCTAssertEqualObjects(message, @"Failed to save", @"Error message should match");
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

// MARK: - Get Method Tests

- (void)testGetItemCallsSwiftImplementation {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Get should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *expectedItem = @{@"key": @"value"};
    
    OCMStub([self.mockSwiftImpl getItem:storageId
                               resolver:[OCMArg any]
                               rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(expectedItem);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTAssertNotNil(result, @"Get should return a result");
                      XCTAssertEqualObjects(result, expectedItem, @"Retrieved item should match saved item");
                      [expectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTFail(@"Get should not reject: %@", message);
                       [expectation fulfill];
                   }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    
    OCMVerify([self.mockSwiftImpl getItem:storageId resolver:[OCMArg any] rejecter:[OCMArg any]]);
}

- (void)testGetItemReturnsNilWhenEmpty {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Get should return nil when empty"];
    
    NSString *storageId = @"empty-storage-id";
    
    OCMStub([self.mockSwiftImpl getItem:storageId
                               resolver:[OCMArg any]
                               rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(nil);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTAssertNil(result, @"Get should return nil when no data exists");
                      [expectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTFail(@"Get should not reject when empty: %@", message);
                       [expectation fulfill];
                   }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

- (void)testGetItemRejectsOnError {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Get should reject on error"];
    
    NSString *storageId = @"invalid-storage-id";
    
    NSError *testError = [NSError errorWithDomain:@"TestDomain" code:404 userInfo:nil];
    OCMStub([self.mockSwiftImpl getItem:storageId
                               resolver:[OCMArg any]
                               rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:4];
            reject(@"E_GET_FAILED", @"Failed to get item", testError);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTFail(@"Get should not resolve on error");
                      [expectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTAssertEqualObjects(code, @"E_GET_FAILED", @"Error code should match");
                       XCTAssertEqualObjects(message, @"Failed to get item", @"Error message should match");
                       [expectation fulfill];
                   }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

// MARK: - Delete Method Tests

- (void)testDeleteItemCallsSwiftImplementation {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Delete should complete"];
    
    NSString *storageId = @"test-storage-id";
    
    OCMStub([self.mockSwiftImpl deleteItem:storageId
                                  resolver:[OCMArg any]
                                  rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(@YES);
        });
    
    [self.storage deleteItem:storageId
                     resolve:^(id result) {
                         XCTAssertNotNil(result, @"Delete should return a result");
                         XCTAssertTrue([result boolValue], @"Delete should return true on success");
                         [expectation fulfill];
                     }
                      reject:^(NSString *code, NSString *message, NSError *error) {
                          XCTFail(@"Delete should not reject: %@", message);
                          [expectation fulfill];
                      }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    
    OCMVerify([self.mockSwiftImpl deleteItem:storageId resolver:[OCMArg any] rejecter:[OCMArg any]]);
}

- (void)testDeleteItemRejectsOnError {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Delete should reject on error"];
    
    NSString *storageId = @"invalid-storage-id";
    
    NSError *testError = [NSError errorWithDomain:@"TestDomain" code:500 userInfo:nil];
    OCMStub([self.mockSwiftImpl deleteItem:storageId
                                  resolver:[OCMArg any]
                                  rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:4];
            reject(@"E_DELETE_FAILED", @"Failed to delete", testError);
        });
    
    [self.storage deleteItem:storageId
                     resolve:^(id result) {
                         XCTFail(@"Delete should not resolve on error");
                         [expectation fulfill];
                     }
                      reject:^(NSString *code, NSString *message, NSError *error) {
                          XCTAssertEqualObjects(code, @"E_DELETE_FAILED", @"Error code should match");
                          XCTAssertEqualObjects(message, @"Failed to delete", @"Error message should match");
                          [expectation fulfill];
                      }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

// MARK: - Parameter Validation Tests

- (void)testSaveWithNilIdDoesNotCrash {
    // This test verifies that the module handles nil parameters gracefully
    // In production, React Native should prevent nil parameters, but we test defensive coding
    XCTestExpectation *expectation = [self expectationWithDescription:@"Should handle nil id"];
    
    OCMStub([self.mockSwiftImpl save:nil
                                item:[OCMArg any]
                            resolver:[OCMArg any]
                            rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:5];
            reject(@"E_INVALID_PARAM", @"Invalid storage id", nil);
        });
    
    [self.storage save:nil
                  item:@{@"key": @"value"}
               resolve:^(id result) {
                   XCTFail(@"Should not resolve with nil id");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
}

@end
