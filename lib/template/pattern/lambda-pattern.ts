/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export interface LambdaPatternConstructProps {
    projectFullName: string;
    baseName: string;
    lambdaPath: string;
    policies: string[] | iam.PolicyStatement[];
    handler?: string;
    environments?: any;
    timeout?: cdk.Duration;
    bucket?: s3.Bucket;
    layerArns?: string[];
    bucketPrefix?: string[];
    bucketSuffix?: string[];
}

export class LambdaPattern extends Construct {
    public readonly lambdaFunction: lambda.Function;
    public readonly lambdaRole: iam.Role;

    constructor(scope: Construct, id: string, props: LambdaPatternConstructProps) {
        super(scope, id);

        const lambdaName: string = `${props.projectFullName}-${props.baseName}-Lambda`;
        const roleName: string = `${props.projectFullName}-${props.baseName}-Lambda-Role`;

        this.lambdaRole = this.createRole(roleName, props.policies);
        this.lambdaFunction = this.createLambda(lambdaName, props.lambdaPath, this.lambdaRole, props);
    }

    private createLambda(lambdaName: string, lambdaPath: string, lambdaRole: iam.Role, props: LambdaPatternConstructProps): lambda.Function {
        var layers = this.loadLayers(lambdaName, props.layerArns!);

        const lambdaFunction = new lambda.Function(this, lambdaName, {
            functionName: lambdaName,
            code: lambda.Code.fromAsset(lambdaPath),
            handler: props.handler != undefined ? props.handler : 'handler.handle',
            runtime: lambda.Runtime.PYTHON_3_7,
            timeout: props.timeout != undefined ? props.timeout : cdk.Duration.seconds(60 * 3),
            role: lambdaRole,
            environment: props.environments,
            layers: layers.length > 0 ? layers : undefined,
        });

        if (props.bucket != undefined) {
            const filterList: any[] = [];
            if (props.bucketPrefix != undefined && props.bucketPrefix.length > 0) {
                for (var item of props.bucketPrefix) {
                    lambdaFunction.addEventSource(new S3EventSource(props.bucket, {
                        events: [s3.EventType.OBJECT_CREATED_PUT, s3.EventType.OBJECT_CREATED_COPY],
                        filters: [{ prefix: item }]
                    }));
                }
            }
            if (props.bucketSuffix != undefined && props.bucketSuffix.length > 0) {
                for (var item of props.bucketSuffix) {
                    lambdaFunction.addEventSource(new S3EventSource(props.bucket, {
                        events: [s3.EventType.OBJECT_CREATED_PUT, s3.EventType.OBJECT_CREATED_COPY],
                        filters: [{ suffix: item }]
                    }));
                }
            }
        }

        return lambdaFunction;
    }

    private createRole(roleName: string, policies: string[] | iam.PolicyStatement[]): iam.Role {
        const role = new iam.Role(this, roleName, {
            roleName: roleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });

        role.addManagedPolicy({ managedPolicyArn: 'arn:aws-us-gov:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' });
        for (var item of policies) {
            if (item instanceof iam.PolicyStatement) {
                role.addToPolicy(item);
            } else {
                role.addManagedPolicy({ managedPolicyArn: item });
            }
        }

        return role;
    }

    private loadLayers(lambdaName: string, layerArns: string[]): any[] {
        let layers = [];

        if (layerArns != undefined && layerArns.length > 0) {
            let index = 0;
            for (let arn of layerArns) {
                index++;
                layers.push(lambda.LayerVersion.fromLayerVersionArn(this, `${lambdaName}-${index}-layer`, arn))
            }
        }

        return layers;
    }
}