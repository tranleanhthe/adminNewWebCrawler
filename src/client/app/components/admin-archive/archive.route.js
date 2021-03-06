angular.module('app.adminarchive')
  .config(archiveConfig);

function archiveConfig($stateProvider) {
  $stateProvider
    .state('layout.archive', {
      url: '/adminarchive',
      views: {
        'layout@content': {
          templateUrl: 'app/components/admin-archive/archive.html',
          controller: 'ArchiveController',
          controllerAs: 'vm'
        }
      }

    });
}
