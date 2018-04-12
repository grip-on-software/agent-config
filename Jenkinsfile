pipeline {
    agent { label 'docker' }

    environment {
        IMAGE = "${env.DOCKER_REGISTRY}/gros-agent-config"
        IMAGE_TAG = env.BRANCH_NAME.replaceFirst('^master$', 'latest')
        SCANNER_HOME = tool name: 'SonarQube Scanner 3', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
    }

    options {
        gitLabConnection('gitlab')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }
    triggers {
        gitlab(triggerOnPush: true, triggerOnMergeRequest: true, branchFilterType: 'All')
        cron('H H * * 5')
    }

    post {
        failure {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'failed'
        }
        aborted {
            updateGitlabCommitStatus name: env.JOB_NAME, state: 'canceled'
        }
        always {
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, includes: 'junit/**/*,html/**/*', keepAll: false, reportDir: 'test-report', reportFiles: 'html/htmlReport.html', reportName: 'Test Report', reportTitles: ''])
            publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: false, reportDir: 'coverage', reportFiles: 'lcov-report/index.html', reportName: 'Coverage', reportTitles: ''])
            junit 'test-report/junit/*.xml'
        }
    }

    stages {
        stage('Start') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'running'
            }
        }
        stage('Build') {
            steps {
                checkout scm
                withCredentials([file(credentialsId: 'agent-web-config', variable: 'AGENT_CONFIGURATION')]) {
                    sh 'cp $AGENT_CONFIGURATION config.json'
                    sh 'docker build -t $IMAGE:$IMAGE_TAG . --build-arg NODE_ENV=production'
                }
            }
        }
        stage('Test') {
            agent {
                docker {
                    image '$IMAGE:$IMAGE_TAG'
                    reuseNode true
                }
            }
            steps {
                sh 'NODE_ENV=development npm install && npm run lint && npm test'
            }
        }
        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '${SCANNER_HOME}/bin/sonar-scanner -Dsonar.branch=$BRANCH_NAME'
                }
            }
        }
        stage('Push') {
            when { branch 'master' }
            steps {
                sh 'grep ".version.:" package.json | sed -E "s/^.*.version.: .([0-9.]+).,/\\1/" > .version'
                sh 'docker tag $IMAGE:latest $IMAGE:$(cat .version)'
                sh 'docker push $IMAGE:$(cat .version)'
                sh 'docker push $IMAGE:latest'
            }
        }
        stage('Status') {
            when {
                expression {
                    currentBuild.rawBuild.getCause(hudson.triggers.TimerTrigger$TimerTriggerCause) == null
                }
            }
            steps {
                updateGitlabCommitStatus name: env.JOB_NAME, state: 'success'
            }
        }
    }
}
